import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ethers } from 'ethers';

// Check if Groq API key is configured
if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  GROQ_API_KEY not found in environment. Add it to .env file');
}

export class OnChainAgent {
  constructor() {
    this.llm = null;
    this.tools = {};
  }

  async initialize() {
    try {
      // Initialize Groq LLM
      this.llm = new ChatGroq({
        model: 'llama-3.1-8b-instant',
        temperature: 0,
        groqApiKey: process.env.GROQ_API_KEY,
      });

      // Initialize blockchain tools (GOAT-like interface)
      this.tools = {
        'send_tokens': this.createSendTokensTool(),
        'check_balance': this.createCheckBalanceTool(),
        'get_token_price': this.createGetPriceTool(),
      };

      console.log('✅ OnChainAgent initialized with Groq LLM and blockchain tools');
    } catch (error) {
      console.error('❌ Error initializing OnChainAgent:', error);
      throw error;
    }
  }

  createSendTokensTool() {
    return {
      name: 'send_tokens',
      description: 'Send tokens (native or ERC-20) to another wallet address. Use this when user wants to send tokens.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient wallet address (0x...)' },
          amount: { type: 'string', description: 'Amount to send (as string number)' },
        },
        required: ['to', 'amount'],
      },
      execute: async ({ to, amount }, context) => {
        return {
          status: 'pending_confirmation',
          from: context.userAddress,
          to: to,
          amount: amount,
          tokenAddress: null, // null for native token, would be token address for ERC-20
          tokenSymbol: context.nativeToken,
          chainId: context.chainId,
          rpcUrl: context.rpcUrl,
          message: `Ready to send ${amount} ${context.nativeToken} to ${to}. This requires wallet confirmation.`,
        };
      },
    };
  }

  createCheckBalanceTool() {
    return {
      name: 'check_balance',
      description: 'Check the balance of a wallet address on the current chain. Use this when user asks about balance.',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Wallet address to check (0x...)' },
        },
        required: ['address'],
      },
      execute: async ({ address }, context) => {
        try {
          const provider = new ethers.JsonRpcProvider(context.rpcUrl);
          const balance = await provider.getBalance(address);
          return {
            success: true,
            message: `Balance: ${ethers.formatEther(balance)} ${context.nativeToken}`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Error checking balance: ${error.message}`,
          };
        }
      },
    };
  }

  createGetPriceTool() {
    return {
      name: 'get_token_price',
      description: 'Get the current market price of a cryptocurrency token in USD.',
      parameters: {
        type: 'object',
        properties: {
          token_symbol: { type: 'string', description: 'Token symbol (e.g., bitcoin, ethereum, avalanche-2)' },
        },
        required: ['token_symbol'],
      },
      execute: async ({ token_symbol }) => {
        try {
          const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${token_symbol.toLowerCase()}&vs_currencies=usd`
          );
          const data = await response.json();

          if (data[token_symbol.toLowerCase()]) {
            const price = data[token_symbol.toLowerCase()].usd;
            return {
              success: true,
              message: `${token_symbol} price: $${price}`,
            };
          }

          return {
            success: false,
            message: `Could not find price for ${token_symbol}`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Error fetching price: ${error.message}`,
          };
        }
      },
    };
  }

  async executeCommand(userInput, userAddress, chainId, remotePlayers = [], playerId = 'unknown') {
    if (!this.llm) {
      throw new Error('Agent not initialized');
    }

    try {
      console.log(`\n🤖 Agent processing: "${userInput}"`);
      console.log(`👤 User: ${userAddress} | 🔗 Chain: ${chainId}`);
      console.log(`👥 Connected players: ${remotePlayers.length}`);

      // Build remote players context
      let playersContext = 'No other players connected.';
      if (remotePlayers.length > 0) {
        playersContext = 'Connected players:\n';
        remotePlayers.forEach((player, index) => {
          // playersContext += `  ${index + 1}. ${player.name} (${player.address.substring(0, 6)}...) on chain ${player.chainId}, in level ${player.currentLevel}\n`;
          playersContext += `  ${index + 1}. ${player.name} [${player.address}] on chain ${player.chainId}\n`;
        });
      }

      // Get RPC URL and native token for current chain
      const rpcUrl = this.getRpcUrl(chainId);
      const nativeToken = await this.getChainNativeToken(chainId);

      // Context for tools
      const toolContext = { rpcUrl, nativeToken, userAddress, chainId };

      // Create system prompt with tool descriptions
      const toolDescriptions = Object.values(this.tools)
        .map(tool => `- **${tool.name}**: ${tool.description}`)
        .join('\n');

      const systemPrompt = new SystemMessage(
        `You are a helpful blockchain assistant in a multiplayer RPG game.

YOUR INFORMATION:
- Wallet address: ${userAddress}
- Your blockchain: ${chainId}
- Native token: ${nativeToken}
- Your player ID: ${playerId}

${playersContext}

AVAILABLE TOOLS:
${toolDescriptions}

INSTRUCTIONS:
- When the user wants to send tokens, respond with: I'll send [amount] to [address]. Then use send_tokens tool.
- When the user asks about balance, use check_balance tool.
- When the user asks about prices, use get_token_price tool.
- Always provide clear explanations.
- For transactions, explain what will happen.
- Use tool format: [TOOL_NAME: param1=value1, param2=value2]

Example tool usage:
[send_tokens: to=0x..., amount=0.5]
[check_balance: address=0x...]
[get_token_price: token_symbol=avalanche-2]`
      );

      // Initialize conversation messages
      const messages = [systemPrompt];

      // Add user message
      const userMessage = new HumanMessage(userInput);
      messages.push(userMessage);

      // Agent loop - keep going until no more tools to execute
      let finalResponse = '';
      let iterations = 0;
      const maxIterations = 5;
      let pendingTransaction = null;

      while (iterations < maxIterations) {
        iterations++;
        console.log(`\n📍 Agent loop iteration ${iterations}`);

        // Get LLM response
        const response = await this.llm.invoke(messages);
        const responseText = response.content;
        console.log(`LLM Response: ${responseText}`);

        finalResponse = responseText;

        // Try to extract and execute tools from response
        const toolExecutions = await this.parseAndExecuteTools(
          responseText,
          userAddress,
          chainId,
          remotePlayers,
          toolContext
        );

        if (toolExecutions.length === 0) {
          // No tools to execute, agent is done
          console.log('No tools to execute, ending conversation');
          break;
        }

        // Add assistant message
        messages.push(new AIMessage(responseText));

        // Execute tools and collect results
        let hasTransaction = false;
        let toolResults = '';

        for (const toolExecution of toolExecutions) {
          console.log(`Executing tool: ${toolExecution.name}`);

          if (toolExecution.name === 'send_tokens') {
            // Transaction detected
            pendingTransaction = toolExecution.result;
            hasTransaction = true;
            toolResults += `Tool: send_tokens\nResult: ${toolExecution.result.message}\n`;
          } else {
            // Other tools execute immediately
            const toolResult = toolExecution.result;
            toolResults += `Tool: ${toolExecution.name}\nResult: ${toolResult.message}\n`;
          }
        }

        // If there's a transaction, stop here and let client handle it
        if (hasTransaction) {
          console.log('Transaction pending, stopping agent loop');
          break;
        }

        // Add tool results back to conversation
        const toolMessage = new HumanMessage(
          `Tool execution results:\n${toolResults}`
        );
        messages.push(toolMessage);
      }

      console.log(`✅ Agent finished after ${iterations} iterations\n`);

      return {
        success: true,
        message: finalResponse,
        data: {
          address: userAddress,
          chainId: chainId,
        },
        transaction: pendingTransaction, // null if no transaction
      };
    } catch (error) {
      console.error('❌ Agent error:', error.message);
      throw error;
    }
  }

  async parseAndExecuteTools(message, userAddress, chainId, remotePlayers, toolContext) {
    const executions = [];

    // Parse tool calls in format [TOOL_NAME: param1=value1, param2=value2]
    const toolPattern = /\[(\w+):\s*([^\]]+)\]/g;
    let match;

    while ((match = toolPattern.exec(message)) !== null) {
      const toolName = match[1];
      const paramsString = match[2];

      if (!this.tools[toolName]) {
        console.warn(`Unknown tool: ${toolName}`);
        continue;
      }

      // Parse parameters
      const params = {};
      const paramPattern = /(\w+)=([^,\]]+)/g;
      let paramMatch;

      while ((paramMatch = paramPattern.exec(paramsString)) !== null) {
        const key = paramMatch[1].trim();
        const value = paramMatch[2].trim();
        params[key] = value;
      }

      console.log(`Parsed tool ${toolName} with params:`, params);

      // Special handling for send_tokens to extract recipient correctly
      if (toolName === 'send_tokens') {
        // Try to find correct recipient address (not sender)
        const addressPattern = /0x[a-fA-F0-9]{40}/g;
        const allAddresses = message.match(addressPattern) || [];

        let recipientAddress = params.to;
        for (const addr of allAddresses) {
          if (addr.toLowerCase() !== userAddress.toLowerCase()) {
            recipientAddress = addr;
            break;
          }
        }

        params.to = recipientAddress;
      }

      // Execute tool
      const tool = this.tools[toolName];
      const result = await tool.execute(params, toolContext);

      executions.push({
        name: toolName,
        params,
        result,
      });
    }

    return executions;
  }

  async getChainNativeToken(chainIdHex) {
    try {
      const chainIdDecimal = typeof chainIdHex === 'string' && chainIdHex.startsWith('0x')
        ? parseInt(chainIdHex, 16)
        : chainIdHex;

      const response = await fetch(`https://chainlist.org/chain/${chainIdDecimal}`);

      if (!response.ok) {
        console.warn(`Could not fetch chain info for ${chainIdDecimal}, using default`);
        return 'TOKEN';
      }

      const data = await response.json();

      if (data.nativeCurrency && data.nativeCurrency.symbol) {
        return data.nativeCurrency.symbol;
      }

      return 'TOKEN';
    } catch (error) {
      console.warn(`Error querying chain data: ${error.message}, using default`);
      return 'TOKEN';
    }
  }

  getRpcUrl(chainId) {
    const rpcMap = {
      '0x1': 'https://eth.rpc.blxrbdn.com',
      '0xa': 'https://mainnet.optimism.io',
      '0x89': 'https://polygon-rpc.com',
      '0xa86a': 'https://api.avax.network/ext/bc/C/rpc',
      '0x43114': 'https://api.avax.network/ext/bc/C/rpc',
      '0x38': 'https://bsc-dataseed1.binance.org',
      '0xa869': 'https://api.avax-test.network/ext/bc/C/rpc', // Avalanche Fuji testnet
    };
    return rpcMap[chainId] || 'https://api.avax.network/ext/bc/C/rpc';
  }
}

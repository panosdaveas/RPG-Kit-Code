import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
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

      // Initialize blockchain tools (using ethers.js directly, GOAT-like interface)
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
      description: 'Send tokens (native or ERC-20) to another wallet address',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient wallet address' },
          amount: { type: 'string', description: 'Amount to send' },
          rpc_url: { type: 'string', description: 'RPC URL for the blockchain' },
        },
        required: ['to', 'amount', 'rpc_url'],
      },
      execute: async ({ to, amount, rpc_url }) => {
        // This will be called when LLM decides to use this tool
        // The actual execution happens on client-side in AgentUI
        return {
          type: 'pending_transaction',
          to,
          amount,
          rpc_url,
          message: `Ready to send ${amount} tokens to ${to}. Awaiting wallet confirmation.`,
        };
      },
    };
  }

  createCheckBalanceTool() {
    return {
      name: 'check_balance',
      description: 'Check the balance of a wallet address',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Wallet address to check' },
          rpc_url: { type: 'string', description: 'RPC URL for the blockchain' },
        },
        required: ['address', 'rpc_url'],
      },
      execute: async ({ address, rpc_url }) => {
        try {
          const provider = new ethers.JsonRpcProvider(rpc_url);
          const balance = await provider.getBalance(address);
          return `Balance: ${ethers.formatEther(balance)} native tokens`;
        } catch (error) {
          return `Error checking balance: ${error.message}`;
        }
      },
    };
  }

  createGetPriceTool() {
    return {
      name: 'get_token_price',
      description: 'Get the current price of a cryptocurrency token',
      parameters: {
        type: 'object',
        properties: {
          token_symbol: { type: 'string', description: 'Token symbol (e.g., bitcoin, ethereum, avax)' },
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
            return `${token_symbol} price: $${price}`;
          }

          return `Could not find price for ${token_symbol}`;
        } catch (error) {
          return `Error fetching price: ${error.message}`;
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
          playersContext += `  ${index + 1}. ${player.name} (${player.address.substring(0, 6)}...) on chain ${player.chainId}, in level ${player.currentLevel}\n`;
        });
      }

      // Get RPC URL for current chain
      const rpcUrl = this.getRpcUrl(chainId);

      // Create system prompt with tool descriptions
      const toolDescriptions = Object.values(this.tools)
        .map(tool => `- ${tool.name}: ${tool.description}`)
        .join('\n');

      const systemPrompt = new SystemMessage(
        `You are a helpful blockchain assistant in a multiplayer RPG game.

YOUR INFORMATION:
- Wallet address: ${userAddress}
- Your blockchain: ${chainId}
- RPC URL: ${rpcUrl}
- Your player ID: ${playerId}

${playersContext}

AVAILABLE TOOLS:
${toolDescriptions}

When the user asks to:
- Send tokens: Use send_tokens tool with recipient address and amount
- Check balance: Use check_balance tool
- Get prices: Use get_token_price tool

Always provide helpful explanations along with tool usage.
For transactions, include all details clearly.`
      );

      // Create user message
      const userMessage = new HumanMessage(userInput);

      // Get response from LLM
      const response = await this.llm.invoke([systemPrompt, userMessage]);

      const message = response.content;
      console.log(`✅ Agent response: ${message}\n`);

      // Parse tool usage from response (simple pattern matching)
      const toolResult = await this.parseAndExecuteTools(message, userAddress, chainId, remotePlayers);

      return {
        success: true,
        message: message,
        data: {
          address: userAddress,
          chainId: chainId,
        },
        transaction: toolResult, // null if no transaction, or transaction object
      };
    } catch (error) {
      console.error('❌ Agent error:', error.message);
      throw error;
    }
  }

  async parseAndExecuteTools(message, userAddress, chainId, remotePlayers) {
    // Check if message contains transaction intent
    const sendPatterns = [/send|transfer|pay/i, /proceed with the transaction/i];
    const isSendIntent = sendPatterns.some(pattern => pattern.test(message));

    if (!isSendIntent) {
      return null;
    }

    // Extract ALL addresses from message
    const addressPattern = /0x[a-fA-F0-9]{40}/g;
    const allAddresses = message.match(addressPattern) || [];

    if (allAddresses.length === 0) {
      return null;
    }

    // Find the recipient address - it should be the one that's NOT the sender
    let recipientAddress = null;
    for (const address of allAddresses) {
      if (address.toLowerCase() !== userAddress.toLowerCase()) {
        recipientAddress = address;
        break;
      }
    }

    if (!recipientAddress) {
      recipientAddress = allAddresses[allAddresses.length - 1];
    }

    // Extract amount
    const amountPattern = /(\d+\.?\d*)\s*(AVAX|ETH|TOKEN|wei|gwei|ether)?/i;
    const amountMatch = message.match(amountPattern);
    if (!amountMatch) {
      return null;
    }

    const amount = amountMatch[1];

    // Get native token symbol
    let tokenSymbol = 'TOKEN';
    if (amountMatch[2]) {
      tokenSymbol = amountMatch[2].toUpperCase();
    } else {
      const nativeToken = await this.getChainNativeToken(chainId);
      tokenSymbol = nativeToken;
    }

    console.log(`💰 Transaction detected: ${amount} ${tokenSymbol} to ${recipientAddress}`);

    const rpcUrl = this.getRpcUrl(chainId);

    return {
      type: 'send_tokens',
      from: userAddress,
      to: recipientAddress,
      amount: amount,
      tokenSymbol: tokenSymbol,
      tokenAddress: null,
      chainId: chainId,
      rpcUrl: rpcUrl,
      status: 'pending_confirmation',
    };
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

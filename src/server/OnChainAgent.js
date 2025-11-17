import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { getTools } from '@goat-sdk/core';
import { viem } from '@goat-sdk/wallet-viem';
import { http, createPublicClient, createWalletClient } from 'viem';
import { avalancheFuji, sepolia, mainnet, polygonMumbai } from 'viem/chains';

// Check if Groq API key is configured
if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  GROQ_API_KEY not found in environment. Add it to .env file');
}

export class OnChainAgent {
  constructor() {
    this.llm = null;
    this.chainMap = this.getChainMap();
  }

  // Map chain IDs to viem chain objects
  getChainMap() {
    return {
      43113: avalancheFuji,    // Avalanche Fuji testnet
      43114: avalancheFuji,    // Fallback for Avalanche
      11155111: sepolia,       // Ethereum Sepolia testnet
      1: mainnet,              // Ethereum mainnet
      80001: polygonMumbai,    // Polygon Mumbai testnet
    };
  }

  // Get viem chain object from chainId
  getViemChain(chainId) {
    const chainIdDecimal = typeof chainId === 'string' && chainId.startsWith('0x')
      ? parseInt(chainId, 16)
      : chainId;
    return this.chainMap[chainIdDecimal] || avalancheFuji; // Default to Fuji
  }

  // Get RPC URL for chain
  getChainRpcUrl(chainId) {
    const chain = this.getViemChain(chainId);
    return chain.rpcUrls?.default?.http?.[0] || 'https://api.avax-test.network/ext/bc/C/rpc';
  }

  // Get native token symbol for chain
  getNativeTokenSymbol(chainId) {
    const chainIdDecimal = typeof chainId === 'string' && chainId.startsWith('0x')
      ? parseInt(chainId, 16)
      : chainId;
    const nativeTokenMap = {
      43113: 'AVAX',  // Avalanche Fuji
      43114: 'AVAX',  // Avalanche Mainnet
      11155111: 'ETH', // Ethereum Sepolia
      1: 'ETH',        // Ethereum Mainnet
      80001: 'MATIC',  // Polygon Mumbai
    };
    return nativeTokenMap[chainIdDecimal] || 'NATIVE_TOKEN';
  }

  async initialize() {
    try {
      // Initialize Groq LLM
      this.llm = new ChatGroq({
        model: 'llama-3.1-8b-instant',
        temperature: 0,
        groqApiKey: process.env.GROQ_API_KEY,
      });

      console.log('✅ OnChainAgent initialized with Groq LLM and GOAT SDK');
      console.log('🔗 Tools will be loaded per-request using GOAT SDK framework');
    } catch (error) {
      console.error('❌ Error initializing OnChainAgent:', error);
      throw error;
    }
  }

  async initializeGoatTools(userAddress, chainId) {
    try {
      console.log(`🔗 [GOAT] Initializing GOAT SDK for ${userAddress} on chain ${chainId}`);

      // Get the viem chain object for this chainId
      const viemChain = this.getViemChain(chainId);
      const rpcUrl = this.getChainRpcUrl(chainId);

      console.log(`[GOAT] Using chain: ${viemChain.name}, RPC: ${rpcUrl}`);

      // Create viem wallet client with just the user's address (no private key needed for reads)
      // This is read-only mode - the client can query data but can't sign transactions
      const walletClient = createWalletClient({
        account: userAddress,
        chain: viemChain,
        transport: http(rpcUrl),
      });

      console.log('[GOAT] Created viem wallet client, wrapping with GOAT SDK adapter...');

      // Wrap the viem wallet client with GOAT SDK's viem adapter
      const goatWallet = viem(walletClient);

      console.log('[GOAT] Wallet adapter created, fetching GOAT tools...');

      // Get GOAT SDK tools for this wallet
      const goatTools = await getTools({
        wallet: goatWallet,
      });

      console.log(`✅ [GOAT] Successfully loaded ${goatTools.length} tools from GOAT SDK`);

      // Convert GOAT tools to a map
      const toolsMap = {};
      for (const tool of goatTools) {
        const toolName = tool.name || tool.id;
        console.log(`  ✓ ${toolName}: ${tool.description}`);
        toolsMap[toolName] = tool;
      }

      return toolsMap;
    } catch (error) {
      console.error('❌ [GOAT] Error initializing GOAT tools:', error.message);
      console.error('[GOAT] Stack trace:', error.stack?.substring(0, 500));
      console.warn('[GOAT] Returning empty tools - agent will have limited functionality');
      return {}; // Return empty object if initialization fails
    }
  }

  async executeCommand(userInput, userAddress, chainId, remotePlayers = [], playerId = 'unknown') {
    if (!this.llm) {
      throw new Error('Agent not initialized');
    }

    try {
      console.log(`\n🤖 Agent processing: "${userInput}"`);
      console.log(`👤 User: ${userAddress} | 🔗 Chain: ${chainId}`);
      console.log(`👥 Connected players: ${remotePlayers.length}`);

      // Initialize GOAT SDK tools for this request
      console.log(`\n🔗 Loading GOAT SDK tools...`);
      const goatTools = await this.initializeGoatTools(userAddress, chainId);

      if (Object.keys(goatTools).length === 0) {
        console.warn('⚠️  No GOAT tools loaded, agent may have limited functionality');
      }

      // Build tool descriptions for LLM - include brief descriptions
      const toolDescriptions = Object.values(goatTools)
        .slice(0, 15) // Limit to 15 tools to save tokens
        .map(tool => {
          const name = tool.name || 'unknown';
          const desc = tool.description || 'No description';
          // Truncate long descriptions to save tokens
          const shortDesc = desc.length > 80 ? desc.substring(0, 77) + '...' : desc;
          return `${name}: ${shortDesc}`;
        })
        .join('\n');

      // Build connected players info for the agent
      const playersInfo = remotePlayers.length > 0
        ? remotePlayers.map(p => `- ${p.name || p.address}: ${p.address}`).join('\n')
        : 'No players currently connected';

      const nativeTokenSymbol = this.getNativeTokenSymbol(chainId);

      const systemPrompt = new SystemMessage(
        `Blockchain assistant in RPG. Wallet: ${userAddress}, Chain: ${chainId}
Native Token: ${nativeTokenSymbol}

CONNECTED PLAYERS (valid addresses for transfers):
${playersInfo}

IMPORTANT:
- When user says "send tokens" or "send 1 tokens" without specifying a token name, they mean the native token (${nativeTokenSymbol})
- When user says "send 1 token name" (like "send 1 avax" or "send 1 eth"), use that specific token name

CRITICAL - ADDRESS VALIDATION (EXACT MATCH REQUIRED):
- If user mentions an address, ALWAYS check if it EXACTLY matches a complete address in the CONNECTED PLAYERS list FIRST
- Address MUST be a complete match - no partial matches, no substrings, no truncated addresses
- Examples of INVALID addresses to reject:
  * "1234" when connected player is "0x1234abcd..." - REJECT (substring/truncated)
  * "0x1234" when connected player is "0x1234abcdef..." - REJECT (incomplete)
  * Any address that is shorter than or a substring of a valid address - REJECT
- If address is NOT in the connected players list or is incomplete/truncated, respond: "I can only send tokens to players currently in-game. Please use the complete wallet address from the list above."
- DO NOT CALL ANY TOOLS if the address is invalid or incomplete
- Only call tools if you've verified the address matches EXACTLY with a connected player

- For token transfers and approvals, ONLY use addresses of connected players listed above. Never send to unknown addresses.
- When user asks to "list players" or "who is online", provide the connected players list above.
- For NATIVE TOKEN transfers (${nativeTokenSymbol}):
  * ONLY include: recipient and amountInBaseUnits
  * DO NOT include tokenAddress parameter - omit it completely
  * Calculate base units: 0.1 × 10^18 = 100000000000000000
  * Example: [send_token: recipient=0x123..., amountInBaseUnits=100000000000000000]
  * Never use null, "null", or "AVAX_ADDRESS" as parameter values

TOOLS:
${toolDescriptions}

IMPORTANT - DO NOT USE THESE TOOLS:
- sign_typed_data_evm, signTypedDataEvm, sign_message_evm, signMessageEvm
- DO NOT call any signing/message tools - the wallet on the client will handle signing
- Only call send_token for transfers, nothing else

FORMAT: [tool_name: params] using square brackets only.
Example for native tokens: [send_token: recipient=0x123..., amountInBaseUnits=100000000000000000]

Respond to user requests by calling appropriate tools. For transfers, always validate the recipient is in the connected players list. If user asks about connected players, list them directly without calling tools.`
      );

      // Initialize conversation messages
      const messages = [systemPrompt, new HumanMessage(userInput)];

      // Agent loop
      let finalResponse = '';
      let iterations = 0;
      const maxIterations = 5;
      let lastToolExecutions = []; // Track last tool executions for transaction handling

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
          goatTools,
          userAddress,
          chainId,
          remotePlayers
        );

        if (toolExecutions.length === 0) {
          console.log('No tools to execute, ending conversation');
          break;
        }

        // Store for later transaction handling
        lastToolExecutions = toolExecutions;

        // Add assistant message
        messages.push(new AIMessage(responseText));

        // Execute tools and collect results
        let toolResults = '';
        for (const execution of toolExecutions) {
          console.log(`Executing tool: ${execution.name}`);
          toolResults += `Tool: ${execution.name}\nResult: ${execution.result}\n`;
        }

        // Check if there are any write operations in the tool executions
        // Using same comprehensive list as in parseAndExecuteTools()
        const writeOperations = [
          'send_token', 'transfer', 'transfer_erc20',
          'approve_token_evm', 'approve_token', 'approve', 'revoke_token_approval_evm', 'revoke_approval',
          'swap', 'swap_tokens', 'swap_exact_tokens_for_tokens',
          'sendTransaction', 'send_transaction',
          'bridge', 'bridge_tokens',
          'stake', 'unstake', 'claim_rewards',
          'execute_contract', 'call_contract',
        ];
        const hasWriteOperation = toolExecutions.some(ex =>
          writeOperations.includes(ex.name)
        );

        // For read-only tools (when no write operations), end conversation after execution
        if (toolExecutions.length > 0 && !hasWriteOperation) {
          console.log('Only read-only tools executed, ending conversation');
          finalResponse = toolResults.replace('Tool: ', '').replace('Result: ', '');
          break;
        }

        // Add tool results back to conversation
        messages.push(new HumanMessage(`Tool execution results:\n${toolResults}`));
      }

      console.log(`✅ Agent finished after ${iterations} iterations\n`);

      // Check if any write operations were executed that need wallet confirmation
      console.log(`[executeCommand] Checking lastToolExecutions (${lastToolExecutions.length} items):`, lastToolExecutions.map(ex => ex.name));
      const transactionOps = [
        'send_token', 'approve_token_evm', 'revoke_token_approval_evm',
        'transfer', 'approve', 'swap', 'sendTransaction', 'bridge', 'stake'
      ];
      const writeOperations = lastToolExecutions.filter(ex =>
        transactionOps.includes(ex.name)
      );

      console.log(`[executeCommand] Found ${writeOperations.length} write operations`);

      let transaction = null;
      if (writeOperations.length > 0) {
        const operation = writeOperations[0];
        console.log(`[executeCommand] Building transaction data for: ${operation.name}`);
        transaction = this.buildTransactionData(operation, userAddress, chainId);
        console.log(`[executeCommand] Transaction object:`, transaction);
      }

      return {
        success: true,
        message: finalResponse,
        data: {
          address: userAddress,
          chainId: chainId,
        },
        transaction: transaction,
      };
    } catch (error) {
      console.error('❌ Agent error:', error.message);
      throw error;
    }
  }

  buildTransactionData(operation, userAddress, chainId) {
    try {
      const params = operation.params;
      let to = params.recipient || params.spender || '';
      let tokenAddress = params.tokenAddress || null;
      // The agent might pass 'amount' or 'amountInBaseUnits'
      let amount = params.amountInBaseUnits || params.amount || params.amount_in_base_units || '0';
      let tokenSymbol = params.tokenSymbol || 'NATIVE';

      console.log(`[buildTransactionData] Parsed params:`, { to, amount, tokenAddress, tokenSymbol });

      // If amount is a string representation of a number, use it as-is
      if (typeof amount === 'string' && amount.match(/^\d+$/)) {
        // It's already in base units
      } else if (typeof amount === 'string') {
        // Try to parse it
        amount = amount.toString();
      }

      // Parse the result to extract actual values if tool was executed
      if (operation.result && typeof operation.result === 'string') {
        try {
          const resultJson = JSON.parse(operation.result);
          if (resultJson.token_address) tokenAddress = resultJson.token_address;
          if (resultJson.symbol) tokenSymbol = resultJson.symbol;
        } catch (e) {
          // Result might not be JSON, that's okay
        }
      }

      const viemChain = this.getViemChain(chainId);
      const chainExplorer = {
        43113: 'https://testnet.snowtrace.io',
        43114: 'https://snowtrace.io',
        11155111: 'https://sepolia.etherscan.io',
        1: 'https://etherscan.io',
        80001: 'https://mumbai.polygonscan.com',
      };

      return {
        status: 'pending_confirmation',
        from: userAddress,
        to: to,
        amount: this.formatAmountForDisplay(amount, 18),
        amountInBaseUnits: amount,
        tokenAddress: tokenAddress,
        tokenSymbol: tokenSymbol,
        chainId: chainId,
        chainName: viemChain.name,
        blockExplorerUrl: chainExplorer[this.getChainIdDecimal(chainId)],
      };
    } catch (error) {
      console.error('Error building transaction data:', error.message);
      return null;
    }
  }

  formatAmountForDisplay(baseUnits, decimals = 18) {
    try {
      const num = BigInt(baseUnits);
      const divisor = BigInt(10) ** BigInt(decimals);
      const whole = num / divisor;
      const remainder = num % divisor;

      if (remainder === 0n) {
        return whole.toString();
      }

      const fractionalStr = remainder.toString().padStart(decimals, '0');
      const trimmed = fractionalStr.replace(/0+$/, '');
      return `${whole.toString()}.${trimmed}`;
    } catch (e) {
      return baseUnits;
    }
  }

  getChainIdDecimal(chainId) {
    if (typeof chainId === 'string' && chainId.startsWith('0x')) {
      return parseInt(chainId, 16);
    }
    return chainId;
  }

  async parseAndExecuteTools(message, goatTools, userAddress, chainId, remotePlayers = []) {
    const executions = [];

    // Helper: Build set of valid player addresses
    const validAddresses = new Set(
      remotePlayers
        .map(p => p.address?.toLowerCase?.())
        .filter(addr => addr)
    );

    // Helper: Check if address is a valid player address
    const isValidPlayerAddress = (address) => {
      if (!address) return false;
      return validAddresses.has(address.toLowerCase());
    };

    // Parse tool calls in format [TOOL_NAME] or [TOOL_NAME: param1=value1, param2=value2]
    // Also try backtick format as fallback: `tool_name: params`
    const toolPatternBrackets = /\[(\w+)(?::\s*([^\]]*))?\]/g;
    const toolPatternBackticks = /`(\w+):\s*([^`]*)`/g;

    let match;

    // Try bracket format first
    let toolPattern = toolPatternBrackets;
    let matches = [];
    while ((match = toolPattern.exec(message)) !== null) {
      matches.push([match[1], match[2] || '']);
    }

    // If no bracket format found, try backtick format
    if (matches.length === 0) {
      console.log('[parseAndExecuteTools] No bracket format tools found, trying backtick format');
      toolPattern = toolPatternBackticks;
      while ((match = toolPattern.exec(message)) !== null) {
        matches.push([match[1], match[2] || '']);
      }
      if (matches.length > 0) {
        console.log('[parseAndExecuteTools] Found tools in backtick format');
      }
    }

    // Define write operations that require wallet confirmation
    // These are tools that can move tokens, approve spending, or execute transactions
    const writeOperations = [
      // Token transfers
      'send_token',
      'transfer',
      'transfer_erc20',

      // Token approvals
      'approve_token_evm',
      'approve_token',
      'approve',
      'revoke_token_approval_evm',
      'revoke_approval',

      // Swaps and DEX operations
      'swap',
      'swap_tokens',
      'swap_exact_tokens_for_tokens',

      // Generic transaction sending
      'sendTransaction',
      'send_transaction',

      // Bridge/cross-chain operations
      'bridge',
      'bridge_tokens',

      // Staking operations
      'stake',
      'unstake',
      'claim_rewards',

      // Contract interactions that might transfer value
      'execute_contract',
      'call_contract',

      // Signing operations that require wallet access
      'sign_message',
      'signMessage',
      'sign_typed_data',
      'signTypedData',
      'verify_message',
    ];

    // Map tools to their address parameter names
    // This ensures we validate the correct parameter for each tool type
    const addressParamsByTool = {
      'send_token': ['to', 'recipient'],
      'transfer': ['to', 'recipient'],
      'transfer_erc20': ['to', 'recipient'],
      'approve': ['spender'],
      'approve_token_evm': ['spender'],
      'approve_token': ['spender'],
      'revoke_token_approval_evm': ['spender'],
      'revoke_approval': ['spender'],
      'swap': ['to', 'recipient'],
      'swap_tokens': ['to', 'recipient'],
      'swap_exact_tokens_for_tokens': ['to', 'recipient'],
      'bridge': ['to', 'recipient'],
      'bridge_tokens': ['to', 'recipient'],
    };

    // Process all found tools
    for (const [toolName, paramsString] of matches) {
      // Check if tool exists in GOAT tools
      if (!goatTools[toolName]) {
        console.warn(`Unknown tool: ${toolName}`);
        continue;
      }

      // Parse parameters with support for complex JSON values
      const params = {};
      let i = 0;
      while (i < paramsString.length) {
        // Find the next parameter name (word=)
        const nameMatch = paramsString.substring(i).match(/^(\w+)=/);
        if (!nameMatch) break;

        const key = nameMatch[1];
        i += nameMatch[0].length;

        // Extract the value - handle JSON objects/arrays specially
        let value = '';
        let depth = 0; // Track nesting depth for {}
        let inString = false;
        let escape = false;

        while (i < paramsString.length) {
          const char = paramsString[i];

          if (escape) {
            value += char;
            escape = false;
            i++;
            continue;
          }

          if (char === '\\') {
            escape = true;
            value += char;
            i++;
            continue;
          }

          if (char === '"') {
            inString = !inString;
            value += char;
            i++;
            continue;
          }

          if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') depth--;
            else if (char === '[') depth++;
            else if (char === ']') depth--;
            // Stop at comma or closing bracket if we're not inside JSON
            else if ((char === ',' || char === ']') && depth === 0) {
              break;
            }
          }

          value += char;
          i++;
        }

        params[key] = value.trim();

        // Skip comma if present
        if (paramsString[i] === ',') {
          i++;
        }
      }

      // Normalize parameter names for send_token to match GOAT SDK schema
      if (toolName === 'send_token') {
        // Map 'to' to 'recipient' if needed
        if (params.to && !params.recipient) {
          params.recipient = params.to;
          delete params.to;
        }
        // Map 'amount' to 'amountInBaseUnits' if needed
        if (params.amount && !params.amountInBaseUnits) {
          params.amountInBaseUnits = params.amount;
          delete params.amount;
        }
        // Remove invalid tokenAddress values (null, "null", placeholders like "AVAX_ADDRESS")
        if (params.tokenAddress) {
          const tokenAddr = params.tokenAddress.trim().toLowerCase();
          if (tokenAddr === 'null' || tokenAddr === 'undefined' ||
              tokenAddr.includes('_address') || tokenAddr.includes('placeholder')) {
            delete params.tokenAddress;
            console.log('[send_token] Removed invalid tokenAddress:', params.tokenAddress);
          }
        }
      }

      console.log(`Parsed tool ${toolName} with params:`, params);
      console.log(`[Validation] Valid player addresses:`, Array.from(validAddresses));
      console.log(`[Validation] Total remote players:`, remotePlayers.length);

      // Validate recipient/spender addresses for transaction tools
      if (addressParamsByTool[toolName]) {
        // Try to find the address parameter for this tool
        let recipientParam = null;
        for (const paramName of addressParamsByTool[toolName]) {
          if (params[paramName]) {
            recipientParam = params[paramName];
            break;
          }
        }

        console.log(`[Validation] Tool: ${toolName}, Address params checked: ${addressParamsByTool[toolName].join(', ')}, Found address: ${recipientParam}`);

        if (recipientParam) {
          console.log(`[Validation] Validating address: ${recipientParam}`);
          if (!isValidPlayerAddress(recipientParam)) {
            console.warn(`❌ Invalid recipient address: ${recipientParam}. Only connected players allowed.`);
            console.warn(`Available players: ${Array.from(validAddresses).join(', ')}`);
            const availableAddresses = Array.from(validAddresses).length > 0
              ? Array.from(validAddresses).join(', ')
              : 'None connected';
            executions.push({
              name: toolName,
              params,
              result: `Error: Invalid recipient address ${recipientParam}. Only connected players are allowed.\n\nAvailable players:\n${availableAddresses}`,
            });
            continue;
          } else {
            console.log(`✅ Valid player address: ${recipientParam}`);
          }
        }
      }

      // Check if this is a write operation that requires wallet confirmation
      // Also include signing operations that shouldn't be executed by the agent
      const signingOperations = ['sign_typed_data_evm', 'signTypedDataEvm', 'sign_message_evm', 'signMessageEvm'];
      if (writeOperations.includes(toolName) || signingOperations.includes(toolName)) {
        console.log(`⚠️  Write/Signing operation detected: ${toolName} - returning params for wallet confirmation`);
        executions.push({
          name: toolName,
          params,
          result: JSON.stringify({
            status: 'pending_confirmation',
            message: `Ready to ${toolName}. Awaiting wallet signature.`
          }),
        });
        continue;
      }

      // Execute GOAT SDK tool
      try {
        const tool = goatTools[toolName];
        let result;

        if (typeof tool.execute === 'function') {
          result = await tool.execute(params);
        } else if (typeof tool.run === 'function') {
          result = await tool.run(params);
        } else {
          result = 'Tool execution not supported';
        }

        const resultString = typeof result === 'string' ? result : JSON.stringify(result);

        executions.push({
          name: toolName,
          params,
          result: resultString,
        });
      } catch (error) {
        console.error(`Error executing tool ${toolName}:`, error.message);
        executions.push({
          name: toolName,
          params,
          result: `Error: ${error.message}`,
        });
      }
    }

    return executions;
  }
}

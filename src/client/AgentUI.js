import { events } from '../Events.js';

export class AgentUI {
  constructor(hero, walletManager, multiplayerManager, remotePlayers) {
    this.hero = hero;
    this.walletManager = walletManager;
    this.multiplayerManager = multiplayerManager;
    this.remotePlayers = remotePlayers;
    this.container = null;
    this.inputField = null;
    this.messageList = null;
    this.toggleButton = null;
    this.conversationHistory = [];
    this.isInitialized = false;
    this.isOpen = false;
    this.canvas = null;
  }

  initialize() {
    if (this.isInitialized) {
      console.warn('AgentUI already initialized. Skipping duplicate initialization.');
      return;
    }

    // Get the canvas to position relative to it
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
      console.warn('Canvas with id "game-canvas" not found. Agent UI will not be initialized.');
      return;
    }

    this.canvas = canvas;
    this.isInitialized = true;

    // Create UI
    this.createAgentButton();
    this.createDrawer();
    this.setupEventListeners();
    this.setupResizeListener();

    console.log('AgentUI initialized successfully');
  }

  createAgentButton() {
    const canvasRect = this.canvas.getBoundingClientRect();

    this.toggleButton = document.createElement('button');
    this.toggleButton.id = 'agent-button';
    this.toggleButton.style.position = 'fixed';
    this.toggleButton.style.top = canvasRect.top + 'px';
    this.toggleButton.style.left = 30 + 'px'; // Next to wallet button
    // this.toggleButton.style.padding = '8px 12px';
    this.toggleButton.style.backgroundColor = 'rgba(26, 26, 26, 0.8)';
    this.toggleButton.style.color = '#fff';
    this.toggleButton.style.border = '1px solid rgba(100, 100, 100, 0.5)';
    this.toggleButton.style.borderRadius = '0';
    this.toggleButton.style.width = '30px';
    this.toggleButton.style.height = '30px';
    this.toggleButton.style.cursor = 'pointer';
    this.toggleButton.style.fontSize = '12px';
    this.toggleButton.style.fontFamily = 'Arial, sans-serif';
    this.toggleButton.style.zIndex = '1001';
    this.toggleButton.style.transition = 'background-color 0.2s ease';
    this.toggleButton.textContent = '🤖';

    this.toggleButton.addEventListener('click', () => this.toggleDrawer());

    // Hover effects
    this.toggleButton.addEventListener('mouseover', () => {
      this.toggleButton.style.backgroundColor = 'rgba(40, 40, 40, 0.9)';
    });

    this.toggleButton.addEventListener('mouseout', () => {
      this.toggleButton.style.backgroundColor = 'rgba(26, 26, 26, 0.8)';
    });

    document.body.appendChild(this.toggleButton);
  }

  createDrawer() {
    const canvasRect = this.canvas.getBoundingClientRect();

    // Main container
    this.container = document.createElement('div');
    this.container.id = 'agent-drawer';
    this.container.style.position = 'fixed';
    this.container.style.top = canvasRect.top + 'px';
    this.container.style.right = '-350px'; // Hidden off-screen initially
    this.container.style.width = '350px';
    this.container.style.height = canvasRect.height + 'px';
    this.container.style.zIndex = '1000';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    this.container.style.backdropFilter = 'blur(2px)';
    this.container.style.borderLeft = '1px solid rgba(100, 100, 100, 0.3)';
    this.container.style.transition = 'right 0.3s ease-out';
    this.container.style.fontFamily = 'Arial, sans-serif';
    this.container.style.color = '#fff';
    this.container.style.boxSizing = 'border-box';
    this.container.style.padding = '10px';

    // Header
    const header = document.createElement('div');
    header.style.fontSize = '14px';
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '10px';
    header.style.paddingBottom = '10px';
    header.style.borderBottom = '1px solid rgba(100, 100, 100, 0.3)';
    header.textContent = '🤖 On-Chain Agent';
    this.container.appendChild(header);

    // Message list
    this.messageList = document.createElement('div');
    this.messageList.id = 'agent-messages';
    this.messageList.style.flex = '1';
    this.messageList.style.overflowY = 'auto';
    this.messageList.style.marginBottom = '10px';
    this.messageList.style.fontSize = '11px';
    this.messageList.style.lineHeight = '1.4';
    this.messageList.style.wordWrap = 'break-word';

    // Scrollbar styling
    this.messageList.style.scrollbarWidth = 'thin';
    this.messageList.style.scrollbarColor = 'rgba(100, 100, 100, 0.5) transparent';

    this.container.appendChild(this.messageList);

    // Input field container
    const inputContainer = document.createElement('div');
    inputContainer.style.display = 'flex';
    inputContainer.style.gap = '5px';
    inputContainer.style.paddingTop = '10px';
    inputContainer.style.borderTop = '1px solid rgba(100, 100, 100, 0.3)';

    // Input field
    this.inputField = document.createElement('input');
    this.inputField.type = 'text';
    this.inputField.placeholder = '> Ask anything...';
    this.inputField.style.flex = '1';
    this.inputField.style.padding = '6px 8px';
    this.inputField.style.backgroundColor = 'rgba(26, 26, 26, 0.8)';
    this.inputField.style.color = '#fff';
    this.inputField.style.border = '1px solid rgba(100, 100, 100, 0.3)';
    this.inputField.style.borderRadius = '3px';
    this.inputField.style.fontSize = '11px';
    this.inputField.style.fontFamily = 'Arial, sans-serif';
    this.inputField.style.outline = 'none';

    this.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    this.inputField.addEventListener('focus', () => {
      this.inputField.style.borderColor = 'rgba(100, 150, 255, 0.5)';
    });

    this.inputField.addEventListener('blur', () => {
      this.inputField.style.borderColor = 'rgba(100, 100, 100, 0.3)';
    });

    // Send button
    const sendButton = document.createElement('button');
    sendButton.textContent = '→';
    sendButton.style.padding = '6px 12px';
    sendButton.style.backgroundColor = 'rgba(100, 150, 255, 0.6)';
    sendButton.style.color = '#fff';
    sendButton.style.border = 'none';
    sendButton.style.borderRadius = '3px';
    sendButton.style.cursor = 'pointer';
    sendButton.style.fontSize = '12px';
    sendButton.style.fontFamily = 'Arial, sans-serif';
    sendButton.style.transition = 'background-color 0.2s ease';

    sendButton.addEventListener('click', () => this.sendMessage());
    sendButton.addEventListener('mouseover', () => {
      sendButton.style.backgroundColor = 'rgba(100, 150, 255, 0.8)';
    });
    sendButton.addEventListener('mouseout', () => {
      sendButton.style.backgroundColor = 'rgba(100, 150, 255, 0.6)';
    });

    inputContainer.appendChild(this.inputField);
    inputContainer.appendChild(sendButton);
    this.container.appendChild(inputContainer);

    document.body.appendChild(this.container);
  }

  async sendMessage() {
    const userInput = this.inputField.value.trim();
    if (!userInput) return;

    // Clear input
    this.inputField.value = '';
    this.inputField.focus();

    // Add user message to UI
    this.addMessageToUI(userInput, 'user');

    // Show loading message
    this.addMessageToUI('Processing...', 'agent-loading');

    try {
      // Serialize remote players data
      const remotePlayers = [];
      if (this.remotePlayers) {
        this.remotePlayers.forEach((remoteHero, playerId) => {
          remotePlayers.push({
            id: playerId,
            address: remoteHero.attributes?.get?.('walletAddress') || 'unknown',
            chainId: remoteHero.attributes?.get?.('chainId') || 'unknown',
            name: remoteHero.playerName || `Player_${playerId.substring(0, 6)}`,
            position: { x: remoteHero.position.x, y: remoteHero.position.y },
            currentLevel: remoteHero.currentLevelId,
          });
        });
      }

      // Call backend API
      const response = await fetch('http://localhost:3000/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: userInput,
          userAddress: this.walletManager.address || 'not-connected',
          chainId: this.walletManager.chainId || 'unknown',
          remotePlayers: remotePlayers,
          playerId: this.multiplayerManager?.playerId || 'unknown',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      // Remove loading message
      this.removeLastMessage();

      // Add agent response
      this.addMessageToUI(result.message, 'agent');

      // Check if there's a pending transaction
      if (result.transaction && result.transaction.status === 'pending_confirmation') {
        await this.handlePendingTransaction(result.transaction);
      }

      // Emit event for other systems to listen to agent actions
      events.emit('AGENT_COMMAND_EXECUTED', {
        command: userInput,
        result: result,
      });
    } catch (error) {
      console.error('Error processing agent command:', error);
      this.removeLastMessage();
      this.addMessageToUI(`Error: ${error.message}`, 'agent-error');
    }
  }

  async handlePendingTransaction(transaction) {
    // Show transaction summary
    const txSummary = `
📝 Transaction Pending:
- From: ${transaction.from.substring(0, 6)}...${transaction.from.substring(38)}
- To: ${transaction.to.substring(0, 6)}...${transaction.to.substring(38)}
- Amount: ${transaction.amount} ${transaction.tokenSymbol}
- Chain: ${transaction.chainId}

Confirm to proceed with wallet signature.
    `.trim();

    this.addMessageToUI(txSummary, 'agent');

    // Ask for confirmation
    const confirmed = confirm(`${transaction.amount} ${transaction.tokenSymbol} to ${transaction.to.substring(0, 10)}...?\n\nConfirm in your wallet.`);

    if (!confirmed) {
      this.addMessageToUI('Transaction cancelled by user.', 'agent');
      return;
    }

    // Execute transaction
    try {
      this.addMessageToUI('Executing transaction...', 'agent-loading');
      const txHash = await this.executeTransaction(transaction);
      this.removeLastMessage();
      this.addMessageToUI(`✅ Transaction sent! Hash: ${txHash}`, 'agent');
    } catch (error) {
      this.removeLastMessage();
      this.addMessageToUI(`❌ Transaction failed: ${error.message}`, 'agent-error');
    }
  }

  async executeTransaction(transaction) {
    // Check if wallet is available
    if (!window.ethereum) {
      throw new Error('No wallet provider found. Please connect your wallet.');
    }

    // Import ethers for transaction handling
    const { ethers } = await import('ethers');

    try {
      // Get signer from wallet
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      let txResponse;

      if (transaction.tokenAddress === null) {
        // Native token transfer (AVAX, ETH, etc.)
        const amount = ethers.parseEther(transaction.amount);
        txResponse = await signer.sendTransaction({
          to: transaction.to,
          value: amount,
        });
      } else {
        // ERC-20 token transfer
        const erc20ABI = [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function decimals() view returns (uint8)',
        ];
        const contract = new ethers.Contract(transaction.tokenAddress, erc20ABI, signer);

        const decimals = await contract.decimals();
        const amount = ethers.parseUnits(transaction.amount, decimals);

        txResponse = await contract.transfer(transaction.to, amount);
      }

      console.log(`Transaction sent: ${txResponse.hash}`);
      return txResponse.hash;
    } catch (error) {
      console.error('Transaction execution error:', error);
      throw new Error(error.message || 'Failed to execute transaction');
    }
  }

  addMessageToUI(text, sender = 'user') {
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '8px';
    messageDiv.style.padding = '6px 8px';
    messageDiv.style.borderRadius = '3px';
    messageDiv.style.wordWrap = 'break-word';

    if (sender === 'user') {
      messageDiv.style.backgroundColor = 'rgba(100, 100, 100, 0.3)';
      messageDiv.style.borderLeft = '2px solid rgba(200, 200, 200, 0.6)';
      messageDiv.textContent = `You: ${text}`;
    } else if (sender === 'agent') {
      messageDiv.style.backgroundColor = 'rgba(80, 80, 80, 0.3)';
      messageDiv.style.borderLeft = '2px solid rgba(180, 180, 180, 0.6)';
      messageDiv.textContent = `Agent: ${text}`;
    } else if (sender === 'agent-error') {
      messageDiv.style.backgroundColor = 'rgba(200, 100, 100, 0.2)';
      messageDiv.style.borderLeft = '2px solid rgba(200, 100, 100, 0.6)';
      messageDiv.textContent = `Agent: ${text}`;
    } else if (sender === 'agent-loading') {
      messageDiv.style.backgroundColor = 'rgba(100, 100, 100, 0.2)';
      messageDiv.style.borderLeft = '2px solid rgba(150, 150, 150, 0.6)';
      messageDiv.textContent = `Agent: ${text}`;
    }

    this.messageList.appendChild(messageDiv);
    this.messageList.scrollTop = this.messageList.scrollHeight;
    this.conversationHistory.push({ sender, text });
  }

  removeLastMessage() {
    if (this.messageList.lastChild) {
      this.messageList.removeChild(this.messageList.lastChild);
      this.conversationHistory.pop();
    }
  }

  toggleDrawer() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.container.style.right = '0';
      this.inputField.focus();
      events.emit('UI_OPEN');
    } else {
      this.container.style.right = '-350px';
      events.emit('UI_CLOSED');
    }
  }

  setupEventListeners() {
    // Listen for wallet changes
    events.on('WALLET_CONNECTED', this, () => {
      this.addMessageToUI('Wallet connected! Ready to transact.', 'agent');
    });

    events.on('WALLET_DISCONNECTED', this, () => {
      this.addMessageToUI('Wallet disconnected.', 'agent');
    });

    events.on('WALLET_CHAIN_CHANGED', this, (data) => {
      this.addMessageToUI(`Chain changed to: ${data.chainId}`, 'agent');
    });
  }

  setupResizeListener() {
    const handleResize = () => {
      if (!this.canvas || !this.container || !this.toggleButton) return;

      const canvasRect = this.canvas.getBoundingClientRect();
      this.container.style.top = canvasRect.top + 'px';
      this.container.style.height = canvasRect.height + 'px';
      this.toggleButton.style.top = canvasRect.top + 10 + 'px';
    };

    window.addEventListener('resize', handleResize);
  }
}

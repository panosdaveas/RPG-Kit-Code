import { events } from '../Events.js';
import { WalletManager } from './WalletManager.js';

export class WalletUI {
  constructor(hero) {
    this.hero = hero;
    this.walletManager = null;
    this.walletButton = null;
    this.isInitialized = false;
    this.canvas = null;
  }

  initialize() {
    // Prevent duplicate initialization
    if (this.isInitialized) {
      console.warn('WalletUI already initialized. Skipping duplicate initialization.');
      return;
    }

    // Get the canvas to position relative to it
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
      console.warn('Canvas with id "game-canvas" not found. Wallet UI will not be initialized.');
      return;
    }

    this.canvas = canvas;
    this.isInitialized = true;

    // Initialize WalletManager
    this.walletManager = new WalletManager(this.hero);
    this.walletManager.initialize();

    // Create wallet button
    this.createWalletButton();

    // Setup resize listener
    this.setupResizeListener();

    // Listen for wallet events
    this.setupEventListeners();
  }

  createWalletButton() {
    const canvasRect = this.canvas.getBoundingClientRect();

    this.walletButton = document.createElement('button');
    this.walletButton.id = 'wallet-button';
    this.walletButton.style.position = 'fixed';
    this.walletButton.style.top = canvasRect.top + 'px';
    this.walletButton.style.left = '60px';
    // this.walletButton.style.padding = '8px 16px';
    this.walletButton.style.backgroundColor = 'rgba(26, 26, 26, 0.8)';
    this.walletButton.style.color = '#fff';
    this.walletButton.style.height = '30px';
    this.walletButton.style.border = '1px solid rgba(100, 100, 100, 0.5)';
    this.walletButton.style.borderRadius = '0px';
    // this.walletButton.style.cursor = 'pointer';
    this.walletButton.style.fontSize = '14px';
    this.walletButton.style.fontFamily = 'fontRetroGaming';
    this.walletButton.style.zIndex = '1001';
    this.walletButton.style.transition = 'background-color 0.2s ease';
    this.walletButton.style.whiteSpace = 'nowrap';

    // Set initial button text
    this.updateButtonText();

    // Add click handler
    this.walletButton.addEventListener('click', () => this.handleButtonClick());

    // Add right-click handler to copy address
    this.walletButton.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.walletManager.isConnected && this.walletManager.address) {
        this.copyAddressToClipboard();
      }
    });

    // Add hover effects
    this.walletButton.addEventListener('mouseover', () => {
      this.walletButton.style.backgroundColor = 'rgba(40, 40, 40, 0.9)';
    });

    this.walletButton.addEventListener('mouseout', () => {
      this.walletButton.style.backgroundColor = 'rgba(26, 26, 26, 0.8)';
    });

    document.body.appendChild(this.walletButton);
  }

  updateButtonText() {
    if (!this.walletButton) return;

    if (this.walletManager.isConnected && this.walletManager.address) {
      const addressShort = this.walletManager.address.substring(0, 6) + '...' +
                           this.walletManager.address.substring(38);
      this.walletButton.textContent = `(${addressShort})`;
      // this.walletButton.style.borderColor = 'rgba(100, 200, 100, 0.7)';
    } else {
      this.walletButton.textContent = '𝄃𝄃𝄂𝄂𝄀𝄁𝄃𝄂𝄂𝄃';
      // this.walletButton.style.borderColor = 'rgba(100, 100, 100, 0.5)';
    }
  }

  async handleButtonClick() {
    if (this.walletManager.isConnected && this.walletManager.address) {
      // Disconnect
      this.walletManager.disconnect();
    } else {
      // Connect
      await this.walletManager.connect();
    }
    this.updateButtonText();
  }

  setupEventListeners() {
    // Listen for wallet connection events
    events.on('WALLET_CONNECTED', this, (data) => {
      console.log('Wallet connected:', data);
      this.updateButtonText();
    });

    events.on('WALLET_DISCONNECTED', this, () => {
      console.log('Wallet disconnected');
      this.updateButtonText();
    });

    events.on('WALLET_ACCOUNT_CHANGED', this, (data) => {
      console.log('Wallet account changed:', data);
      this.updateButtonText();
    });

    events.on('WALLET_CHAIN_CHANGED', this, (data) => {
      console.log('Wallet chain changed:', data);
      this.updateButtonText();
    });
  }

  setupResizeListener() {
    const handleResize = () => {
      if (!this.canvas || !this.walletButton) return;

      const canvasRect = this.canvas.getBoundingClientRect();
      this.walletButton.style.top = canvasRect.top + 'px';
    };

    window.addEventListener('resize', handleResize);
  }

  async copyAddressToClipboard() {
    try {
      await navigator.clipboard.writeText(this.walletManager.address);

      // Show visual feedback
      const originalText = this.walletButton.textContent;
      this.walletButton.textContent = 'Copied!';
      // this.walletButton.style.backgroundColor = 'rgba(100, 200, 100, 0.8)';

      // Revert after 1.5 seconds
      setTimeout(() => {
        this.walletButton.textContent = originalText;
        this.walletButton.style.backgroundColor = 'rgba(26, 26, 26, 0.8)';
      }, 1500);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  }
}

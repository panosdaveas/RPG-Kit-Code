import { events } from '../Events.js';

export class WalletManager {
  constructor(hero) {
    this.hero = hero;
    this.provider = window.ethereum;
    this.isConnected = false;
    this.address = null;
    this.chainId = null;
  }

  initialize() {
    // Check if wallet provider is available
    if (!this.provider) {
      console.log('No wallet provider found (window.ethereum not available)');
      return;
    }

    // Listen for wallet connection
    this.provider.on('connect', (connectInfo) => {
      console.log('Wallet connected:', connectInfo);
      this.onConnect(connectInfo);
    });

    // Listen for account changes
    this.provider.on('accountsChanged', (accounts) => {
      console.log('Accounts changed:', accounts);
      if (accounts.length === 0) {
        this.onDisconnect();
      } else {
        this.onAccountChanged(accounts[0]);
      }
    });

    // Listen for chain/network changes
    this.provider.on('chainChanged', (chainId) => {
      console.log('Chain changed:', chainId);
      this.onChainChanged(chainId);
    });

    // Listen for disconnect
    this.provider.on('disconnect', (error) => {
      console.log('Wallet disconnected:', error);
      this.onDisconnect();
    });

    // Check if already connected
    this.checkConnection();
  }

  async checkConnection() {
    if (!this.provider) return;

    try {
      const accounts = await this.provider.request({
        method: 'eth_accounts'
      });

      if (accounts.length > 0) {
        this.address = accounts[0];
        this.isConnected = true;

        // Get chain ID
        const chainId = await this.provider.request({
          method: 'eth_chainId'
        });
        this.chainId = chainId;

        this.updateHeroAttributes();
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  }

  async connect() {
    if (!this.provider) {
      console.error('No wallet provider available');
      return false;
    }

    try {
      const accounts = await this.provider.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        this.address = accounts[0];
        this.isConnected = true;

        // Get chain ID
        const chainId = await this.provider.request({
          method: 'eth_chainId'
        });
        this.chainId = chainId;

        this.updateHeroAttributes();
        events.emit('WALLET_CONNECTED', {
          address: this.address,
          chainId: this.chainId
        });

        return true;
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      return false;
    }
  }

  disconnect() {
    this.address = null;
    this.chainId = null;
    this.isConnected = false;
    this.updateHeroAttributes();
    events.emit('WALLET_DISCONNECTED', {});
  }

  onConnect(connectInfo) {
    this.isConnected = true;
    this.chainId = connectInfo.chainId;
    this.updateHeroAttributes();
    events.emit('WALLET_CONNECTED', {
      address: this.address,
      chainId: this.chainId
    });
  }

  onAccountChanged(address) {
    this.address = address;
    this.updateHeroAttributes();
    events.emit('WALLET_ACCOUNT_CHANGED', {
      address: this.address,
      chainId: this.chainId
    });
  }

  onChainChanged(chainId) {
    this.chainId = chainId;
    this.updateHeroAttributes();
    events.emit('WALLET_CHAIN_CHANGED', {
      address: this.address,
      chainId: this.chainId
    });
  }

  onDisconnect() {
    this.address = null;
    this.chainId = null;
    this.isConnected = false;
    this.updateHeroAttributes();
    events.emit('WALLET_DISCONNECTED', {});
  }

  updateHeroAttributes() {
    if (!this.hero) return;

    if (this.isConnected && this.address) {
      this.hero.attributes.set('walletAddress', this.address);
      this.hero.attributes.set('chainId', this.chainId);
    } else {
      this.hero.attributes.remove('walletAddress');
      this.hero.attributes.remove('chainId');
    }

    // Broadcast the updated attributes to the server
    this.hero.broadcastAttributes();
  }
}

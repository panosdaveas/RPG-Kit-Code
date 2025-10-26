import { events, CHAT_MESSAGE_RECEIVED, CHAT_ROOM_CHANGED } from "../Events.js";

export class ChatUI {
    constructor(multiplayerManager = null, remotePlayers = null) {
        this.allMessages = []; // Store all messages
        this.container = null;
        this.inputField = null;
        this.messageList = null;
        this.targetPlayerDropdown = null;
        this.subscriptionIds = [];
        this.multiplayerManager = multiplayerManager;
        this.remotePlayers = remotePlayers || new Map(); // Map of playerId -> player data
        this.selectedTargetPlayerId = null; // null = global/level chat, otherwise private chat with this player
        this.currentPlayerId = null; // Store our own player ID for proper room filtering
    }

    initialize() {
        // Get the canvas to position relative to it
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.warn('Canvas with id "game-canvas" not found. Chat UI will not be initialized.');
            return;
        } else {
            console.log('Canvas found. Initializing Chat UI.');
        }

        this.canvas = canvas;

        // Get the actual rendered dimensions of the canvas
        const canvasRect = canvas.getBoundingClientRect();
        const canvasWidth = canvasRect.width;
        const canvasHeight = canvasRect.height;

        // Create and style the overlay container with fixed positioning (relative to window)
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.top = canvasRect.top + 'px';
        this.container.style.left = 0 + 'px';
        this.container.style.width = '140px';
        this.container.style.height = canvasHeight + 'px';
        this.container.style.zIndex = '1000';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.margin = '0';
        this.container.style.padding = '0';
        this.container.style.paddingBottom = '16px';
        this.container.style.boxSizing = 'border-box';

        // Append to body
        document.body.appendChild(this.container);

        this.setupUI();
        this.setupEventListeners();
        this.setupResizeListener();
    }

    setupResizeListener() {
        // Update chat container position and size on window resize
        const handleResize = () => {
            if (!this.canvas || !this.container) return;

            const canvasRect = this.canvas.getBoundingClientRect();
            this.container.style.top = canvasRect.top + 'px';
            this.container.style.height = canvasRect.height + 'px';
        };

        window.addEventListener('resize', handleResize);
    }

    setupUI() {
        // Clear any existing content
        this.container.innerHTML = '';

        // Create scrollable message list
        this.messageList = document.createElement('div');
        this.messageList.className = 'chat-messages';
        this.messageList.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 5px;
            color: #fff;
            font-family: monospace;
            font-size: 10px;
            border: none;
            word-wrap: break-word;
            min-height: 0;
        `;

        // Create target player selector dropdown
        this.targetPlayerDropdown = document.createElement('select');
        this.targetPlayerDropdown.style.cssText = `
            width: 100%;
            padding: 3px;
            margin: 4px 0;
            background-color: rgba(26, 26, 26, 0.8);
            color: #fff;
            border: 1px solid rgba(100, 100, 100, 0.5);
            font-family: monospace;
            font-size: 9px;
        `;
        this.updatePlayerDropdown();
        this.targetPlayerDropdown.addEventListener('change', (e) => {
            this.selectedTargetPlayerId = e.target.value === 'global' ? null : e.target.value;

            // If selecting a player, join their private room to receive messages
            if (this.selectedTargetPlayerId && this.multiplayerManager) {
                this.multiplayerManager.joinPrivateChat(this.selectedTargetPlayerId);
            }

            // Re-render the message list when switching targets
            this.rerenderMessages();
        });

        // Create input container
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            padding: 4px;
            flex-shrink: 0;
        `;

        // Create input field
        this.inputField = document.createElement('input');
        this.inputField.type = 'text';
        this.inputField.placeholder = 'Msg... or /pm PlayerName msg';
        this.inputField.style.cssText = `
            flex: 1;
            padding: 4px;
            background-color: rgba(26, 26, 26, 0.8);
            color: #fff;
            border: 1px solid rgba(100, 100, 100, 0.5);
            font-family: monospace;
            font-size: 10px;
            max-width: 100%;
        `;

        inputContainer.appendChild(this.targetPlayerDropdown);
        inputContainer.appendChild(this.inputField);

        // Add to container - set up flexbox layout
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        // this.container.style.borderColor = 'rgba(100, 100, 100, 0.5)';
        // this.container.style.borderStyle = 'solid';
        // this.container.style.borderWidth = '1px';

        this.container.appendChild(this.messageList);
        this.container.appendChild(inputContainer);
    }

    setupEventListeners() {
        // Listen to CHAT_MESSAGE_RECEIVED event
        const msgId = events.on(CHAT_MESSAGE_RECEIVED, this, (message) => {
            this.addMessage(message);
            this.scrollToBottom();
        });
        this.subscriptionIds.push(msgId);

        // Listen to CHAT_ROOM_CHANGED
        const roomId = events.on(CHAT_ROOM_CHANGED, this, (data) => {
            this.onRoomChanged(data);
        });
        this.subscriptionIds.push(roomId);

        // Input submission
        if (this.inputField) {
            this.inputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const text = this.inputField.value.trim();
                    if (text) {
                        if (this.multiplayerManager && this.multiplayerManager.isConnected) {
                            this.handleMessageInput(text);
                        }
                        this.inputField.value = '';
                    }
                }
            });
        }
    }

    handleMessageInput(text) {
        // Check for /pm command: /pm PlayerName message
        const pmMatch = text.match(/^\/pm\s+(\S+)\s+(.*)/);
        if (pmMatch) {
            const playerName = pmMatch[1];
            const message = pmMatch[2];

            // Find player by name
            let targetPlayerId = null;
            for (const [id, player] of this.remotePlayers) {
                if (player && (player.name === playerName || player.playerName === playerName)) {
                    targetPlayerId = id;
                    break;
                }
            }

            if (targetPlayerId) {
                this.multiplayerManager.sendChatMessage(message, targetPlayerId);
            } else {
                // Show error message
                this.addSystemMessage(`Player "${playerName}" not found in this level`);
            }
        } else {
            // Normal message or to selected player
            this.multiplayerManager.sendChatMessage(text, this.selectedTargetPlayerId);
        }
    }

    updatePlayerDropdown() {
        if (!this.targetPlayerDropdown) return;

        // Clear existing options
        this.targetPlayerDropdown.innerHTML = '';

        // Add global option
        const globalOption = document.createElement('option');
        globalOption.value = 'global';
        globalOption.textContent = 'Global';
        this.targetPlayerDropdown.appendChild(globalOption);

        // Add level option
        const levelOption = document.createElement('option');
        levelOption.value = 'level';
        levelOption.textContent = 'Level';
        levelOption.disabled = true; // Not used since we send to both anyway
        this.targetPlayerDropdown.appendChild(levelOption);

        // Add player options
        for (const [playerId, player] of this.remotePlayers) {
            const option = document.createElement('option');
            option.value = playerId;
            const playerName = player.playerName || player.name || playerId.substring(0, 8);
            option.textContent = `PM: ${playerName}`;
            this.targetPlayerDropdown.appendChild(option);
        }
    }

    addSystemMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            margin-bottom: 3px;
            padding: 2px;
            color: #999;
            font-style: italic;
            font-size: 9px;
        `;
        messageEl.textContent = `[System] ${text}`;
        this.messageList.appendChild(messageEl);
        this.scrollToBottom();
    }

    addMessage(message) {
        // Store all messages
        this.allMessages.push(message);

        // Only display if it matches the current view
        if (this.shouldDisplayMessage(message)) {

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            margin-bottom: 3px;
            padding: 2px;
            word-wrap: break-word;
            line-height: 1.2;
        `;

        // Format: "PlayerName: message text" or "[PRIVATE] PlayerName: message"
        const playerName = message.playerName || 'Unknown';
        const text = message.text || '';
        const isPrivate = message.room && message.room.startsWith('private:');

        // Shorten player name for display in narrow column
        const shortName = playerName.length > 8 ? playerName.substring(0, 8) + '.' : playerName;

        // Add [PRIVATE] indicator if it's a private message
        if (isPrivate) {
            const privateSpan = document.createElement('span');
            privateSpan.style.color = '#ff9999';
            privateSpan.style.fontWeight = 'bold';
            privateSpan.textContent = '[PM] ';
            messageEl.appendChild(privateSpan);
        }

        // Color code the player name for visibility
        const nameSpan = document.createElement('span');
        nameSpan.style.color = this.getColorForPlayer(message.playerId);
        nameSpan.style.fontWeight = 'bold';
        nameSpan.textContent = shortName;

        const colonSpan = document.createElement('span');
        colonSpan.style.color = '#999';
        colonSpan.textContent = ': ';

        const textSpan = document.createElement('span');
        textSpan.style.color = '#fff';
        textSpan.textContent = text;

            messageEl.appendChild(nameSpan);
            messageEl.appendChild(colonSpan);
            messageEl.appendChild(textSpan);

            this.messageList.appendChild(messageEl);
            this.scrollToBottom();
        }
    }

    shouldDisplayMessage(message) {
        if (this.selectedTargetPlayerId === null) {
            // Global/Level view: show all non-private messages
            return !message.room || !message.room.startsWith('private:');
        } else {
            // Private chat view: show only messages in the private room with this player
            if (!message.room || !message.room.startsWith('private:')) {
                return false;
            }

            // Parse the private room to extract both player IDs
            // Format: private:playerId1:playerId2
            const [id1, id2] = this.extractPlayerIdsFromRoom(message.room);

            // Check if the selected player is one of the two in this room
            return id1 === this.selectedTargetPlayerId || id2 === this.selectedTargetPlayerId;
        }
    }

    extractPlayerIdsFromRoom(roomName) {
        // Extract the two player IDs from a private room name
        // Format: private:playerId1:playerId2
        const parts = roomName.split(':');
        if (parts.length !== 3 || parts[0] !== 'private') {
            return [null, null];
        }
        return [parts[1], parts[2]];
    }

    rerenderMessages() {
        // Clear the message list
        this.messageList.innerHTML = '';

        // Re-add only messages that match the current view
        for (const message of this.allMessages) {
            if (this.shouldDisplayMessage(message)) {
                this.displayMessage(message);
            }
        }

        this.scrollToBottom();
    }

    displayMessage(message) {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            margin-bottom: 3px;
            padding: 2px;
            word-wrap: break-word;
            line-height: 1.2;
        `;

        // Format: "PlayerName: message text" or "[PRIVATE] PlayerName: message"
        const playerName = message.playerName || 'Unknown';
        const text = message.text || '';
        const isPrivate = message.room && message.room.startsWith('private:');

        // Shorten player name for display in narrow column
        const shortName = playerName.length > 8 ? playerName.substring(0, 8) + '.' : playerName;

        // Add [PRIVATE] indicator if it's a private message
        if (isPrivate) {
            const privateSpan = document.createElement('span');
            privateSpan.style.color = '#ff9999';
            privateSpan.style.fontWeight = 'bold';
            privateSpan.textContent = '[PM] ';
            messageEl.appendChild(privateSpan);
        }

        // Color code the player name for visibility
        const nameSpan = document.createElement('span');
        nameSpan.style.color = this.getColorForPlayer(message.playerId);
        nameSpan.style.fontWeight = 'bold';
        nameSpan.textContent = shortName;

        const colonSpan = document.createElement('span');
        colonSpan.style.color = '#999';
        colonSpan.textContent = ': ';

        const textSpan = document.createElement('span');
        textSpan.style.color = '#ccc';
        textSpan.textContent = text;

        messageEl.appendChild(nameSpan);
        messageEl.appendChild(colonSpan);
        messageEl.appendChild(textSpan);

        this.messageList.appendChild(messageEl);
    }

    scrollToBottom() {
        if (this.messageList) {
            this.messageList.scrollTop = this.messageList.scrollHeight;
        }
    }

    onRoomChanged(data) {
        // Optional: Show level change notification
        const notificationEl = document.createElement('div');
        notificationEl.style.cssText = `
            margin-bottom: 8px;
            padding: 4px;
            color: #666;
            font-style: italic;
            text-align: center;
        `;
        notificationEl.textContent = `--- Switched to level: ${data.levelId} ---`;

        this.messageList.appendChild(notificationEl);
        this.scrollToBottom();
    }

    getColorForPlayer(playerId) {
        // Generate a consistent color for each player based on their ID
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffa07a', '#98d8c8', '#f7dc6f', '#bb8fce'];
        const hash = playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    destroy() {
        // Clean up event subscriptions
        this.subscriptionIds.forEach(id => {
            events.off(id);
        });
        this.messages = [];
    }
}

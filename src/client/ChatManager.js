import { events, CHAT_MESSAGE_RECEIVED, CHAT_ROOM_CHANGED } from "../Events.js";

export class ChatManager {
    constructor(socket) {
        this.socket = socket;
        this.currentPlayerId = null;
        this.currentChainId = null;
        this.joinedRooms = new Set(); // Track which rooms we're in
        this.setupSocketListeners();
    }

    // Server calls this when player joins global chat
    initialize(playerId, chainId = null) {
        this.currentPlayerId = playerId;
        this.currentChainId = chainId;

        this.socket.emit('chat-join-room', { room: 'global-chat' });
        this.joinedRooms.add('global-chat');

        // Also join the chain room if chainId is provided
        if (chainId) {
            this.socket.emit('chat-join-room', { room: `chain:${chainId}` });
            this.joinedRooms.add(`chain:${chainId}`);
            console.log(`[ChatManager] Initialized with chainId: ${chainId}`);
        }
    }

    // Called when player changes chain
    onChainChanged(newChainId) {
        const oldChainId = this.currentChainId;
        this.currentChainId = newChainId;

        // Leave old chain room
        if (oldChainId) {
            this.socket.emit('chat-leave-room', { room: `chain:${oldChainId}` });
            this.joinedRooms.delete(`chain:${oldChainId}`);
        }

        // Join new chain room
        const newChainRoom = `chain:${newChainId}`;
        this.socket.emit('chat-join-room', { room: newChainRoom });
        this.joinedRooms.add(newChainRoom);

        events.emit(CHAT_ROOM_CHANGED, { chainId: newChainId });
    }

    // Send chat message
    // targetPlayerId: null = use mode, or playerId = private chat
    sendMessage(text, targetPlayerId = null, mode = 'global') {
        const message = {
            from: this.currentPlayerId,
            text: text,
            timestamp: Date.now()
        };

        if (targetPlayerId) {
            // Private message - normalize the room name
            const normalizedRoom = this.normalizePrivateRoom(this.currentPlayerId, targetPlayerId);
            message.room = normalizedRoom;

            console.log(`Sending private message to ${targetPlayerId}, room: ${normalizedRoom}, currentPlayerId: ${this.currentPlayerId}`);

            // Join the private room if we haven't already
            if (!this.joinedRooms.has(normalizedRoom)) {
                this.socket.emit('chat-join-room', { room: normalizedRoom });
                this.joinedRooms.add(normalizedRoom);
            }
        } else {
            // Public message - send to selected mode
            if (mode === 'global') {
                message.room = 'global-chat';
            } else if (mode === 'chain') {
                message.room = `chain:${this.currentChainId}`;
            }
        }

        this.socket.emit('chat-send-message', message);
    }

    normalizePrivateRoom(playerId1, playerId2) {
        // Sort the IDs so the room name is always the same regardless of who initiates
        const [smaller, larger] = [playerId1, playerId2].sort();
        return `private:${smaller}:${larger}`;
    }

    // Join a private chat room with a specific player
    joinPrivateChat(targetPlayerId) {
        const normalizedRoom = this.normalizePrivateRoom(this.currentPlayerId, targetPlayerId);

        console.log(`Joining private chat room: ${normalizedRoom}, with player: ${targetPlayerId}, currentPlayerId: ${this.currentPlayerId}`);

        // Join the private room if we haven't already
        if (!this.joinedRooms.has(normalizedRoom)) {
            this.socket.emit('chat-join-room', { room: normalizedRoom });
            this.joinedRooms.add(normalizedRoom);
        }
    }

    // Listen for incoming messages from server
    setupSocketListeners() {
        this.socket.on('chat-receive-message', (message) => {
            events.emit(CHAT_MESSAGE_RECEIVED, message);
        });

        this.socket.on('chat-player-typing', (data) => {
            events.emit(CHAT_TYPING_INDICATOR, data);
        });
    }

    disconnect() {
        // Server handles room cleanup on disconnect
        this.joinedRooms.clear();
    }
}
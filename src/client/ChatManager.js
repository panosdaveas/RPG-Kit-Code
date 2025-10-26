import { events, CHAT_MESSAGE_RECEIVED, CHAT_ROOM_CHANGED } from "../Events.js";

export class ChatManager {
    constructor(socket) {
        this.socket = socket;
        this.currentPlayerId = null;
        this.currentLevelId = null;
        this.joinedRooms = new Set(); // Track which rooms we're in
        this.setupSocketListeners();
    }

    // Server calls this when player joins global chat
    initialize(playerId) {
        this.currentPlayerId = playerId;
        this.socket.emit('chat-join-room', { room: 'global-chat' });
        this.joinedRooms.add('global-chat');
    }

    // Called when player changes level
    onLevelChanged(newLevelId) {
        const oldLevelId = this.currentLevelId;
        this.currentLevelId = newLevelId;

        // Leave old level room
        if (oldLevelId) {
            this.socket.emit('chat-leave-room', { room: `level:${oldLevelId}` });
            this.joinedRooms.delete(`level:${oldLevelId}`);
        }

        // Join new level room
        const newLevelRoom = `level:${newLevelId}`;
        this.socket.emit('chat-join-room', { room: newLevelRoom });
        this.joinedRooms.add(newLevelRoom);

        events.emit(CHAT_ROOM_CHANGED, { levelId: newLevelId });
    }

    // Send chat message
    sendMessage(text, targetPlayerId = null) {
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
            // Public message (goes to both global + level room)
            message.rooms = ['global-chat', `level:${this.currentLevelId}`];
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

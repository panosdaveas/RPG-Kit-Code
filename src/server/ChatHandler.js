export class ChatHandler {
    constructor(io) {
        this.io = io;
        this.players = new Map(); // playerId -> {name, levelId, socket}
    }

    handleConnection(socket, playerId, playerName) {
        // Store player metadata
        this.players.set(socket.id, {
            playerId,
            name: playerName,
            levelId: 'main-map', // or whatever default
            socketId: socket.id
        });

        // Player joins global chat automatically
        socket.join('global-chat');

        // Setup listeners
        socket.on('chat-join-room', (data) => {
            socket.join(data.room);
        });

        socket.on('chat-leave-room', (data) => {
            socket.leave(data.room);
        });

        socket.on('chat-send-message', (message) => {
            this.handleMessage(socket.id, message);
        });

        socket.on('disconnect', () => {
            this.players.delete(socket.id);
        });
    }

    handleMessage(socketId, message) {
        const player = this.players.get(socketId);
        if (!player) return;

        // Send to appropriate room(s)
        if (message.room) {
            // Private message - normalize the room name so both players are in the same room
            const normalizedRoom = this.normalizePrivateRoom(message.room);
            const enrichedMessage = {
                ...message,
                playerName: player.name,
                playerId: player.playerId,
                timestamp: Date.now(),
                room: normalizedRoom // Preserve room info for client-side filtering
            };
            this.io.to(normalizedRoom).emit('chat-receive-message', enrichedMessage);
        } else if (message.rooms) {
            // Public message to multiple rooms
            message.rooms.forEach(room => {
                const enrichedMessage = {
                    ...message,
                    playerName: player.name,
                    playerId: player.playerId,
                    timestamp: Date.now(),
                    room: room // Preserve which room this message is for
                };
                this.io.to(room).emit('chat-receive-message', enrichedMessage);
            });
        }
    }

    normalizePrivateRoom(roomName) {
        // Extract the two player IDs from the room name
        // Format: private:playerId1:playerId2
        const parts = roomName.split(':');
        if (parts.length !== 3 || parts[0] !== 'private') {
            return roomName;
        }

        const id1 = parts[1];
        const id2 = parts[2];

        // Sort the IDs so the room name is always the same regardless of who initiated
        const [smaller, larger] = [id1, id2].sort();
        return `private:${smaller}:${larger}`;
    }

    // Called when player switches level
    updatePlayerLevel(socketId, newLevelId) {
        const player = this.players.get(socketId);
        if (!player) return;

        const oldLevelId = player.levelId;
        player.levelId = newLevelId;

        // Server-side room management (optional, can be client-driven)
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
            socket.leave(`level:${oldLevelId}`);
            socket.join(`level:${newLevelId}`);
        }
    }
}

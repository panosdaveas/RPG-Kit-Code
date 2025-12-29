export class ChatHandler {
    constructor(io) {
        this.io = io;
        this.players = new Map(); // socketId -> {playerId, name, chainId, socketId}
    }

    handleConnection(socket, playerId, playerName, chainId = null) {
        // Store player metadata
        this.players.set(socket.id, {
            playerId,
            name: playerName,
            chainId: chainId,
            socketId: socket.id
        });

        console.log(`[Chat] Player connected: socketId=${socket.id}, playerId=${playerId}, name=${playerName}, chainId=${chainId}`);

        // Player joins global chat automatically
        socket.join('global-chat');

        // Player joins their chain room if chainId is provided
        if (chainId) {
            socket.join(`chain:${chainId}`);
            console.log(`[Chat] Player ${playerId} joined chain room: chain:${chainId}`);
        }

        // Setup listeners
        socket.on('chat-join-room', (data) => {
            console.log(`[Chat] Socket ${socket.id} joining room: ${data.room}`);
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
            const room = message.room;

            // Check what type of room this is
            if (room.startsWith('private:')) {
                // Private message - normalize the room name so both players are in the same room
                const normalizedRoom = this.normalizePrivateRoom(room);

                // Extract the socket IDs from the room name
                // Format: private:socketId1:socketId2
                const [id1, id2] = this.extractPlayerIdsFromRoom(normalizedRoom);

                // Figure out which ID is the recipient (the one that's NOT the sender)
                const recipientSocketId = (id1 === socketId) ? id2 : id1;

                // Find the recipient's socket and make sure they join the room
                if (recipientSocketId) {
                    // Use the namespace to get all sockets and find the recipient
                    const sockets = this.io.sockets.sockets;
                    if (sockets.has(recipientSocketId)) {
                        const recipientSocket = sockets.get(recipientSocketId);
                        recipientSocket.join(normalizedRoom);
                        console.log(`[Chat] Added recipient ${recipientSocketId} to private room ${normalizedRoom}`);
                    } else {
                        console.warn(`[Chat] Recipient socket ${recipientSocketId} not found in sockets. Available sockets:`, Array.from(sockets.keys()));
                    }
                } else {
                    console.warn(`[Chat] Could not determine recipient socket ID. id1=${id1}, id2=${id2}, sender=${socketId}`);
                }

                const enrichedMessage = {
                    ...message,
                    playerName: player.name,
                    playerId: player.playerId,
                    timestamp: Date.now(),
                    room: normalizedRoom // Preserve room info for client-side filtering
                };
                this.io.to(normalizedRoom).emit('chat-receive-message', enrichedMessage);
            } else if (room.startsWith('chain:')) {
                // Chain message - send to all players in that chain room
                const enrichedMessage = {
                    ...message,
                    playerName: player.name,
                    playerId: player.playerId,
                    timestamp: Date.now(),
                    room: room // Preserve which chain room this is for
                };
                console.log(`[Chat] Sending message to chain room: ${room}`);
                this.io.to(room).emit('chat-receive-message', enrichedMessage);
            } else if (room === 'global-chat') {
                // Global message - send to all players
                const enrichedMessage = {
                    ...message,
                    playerName: player.name,
                    playerId: player.playerId,
                    timestamp: Date.now(),
                    room: room
                };
                console.log(`[Chat] Sending message to global chat`);
                this.io.to('global-chat').emit('chat-receive-message', enrichedMessage);
            }
        } else if (message.rooms) {
            // Legacy: Public message to multiple rooms (kept for backward compatibility)
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
        // Extract the two socket IDs from the room name and normalize the format
        // Format: private:socketId1:socketId2
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

    extractPlayerIdsFromRoom(roomName) {
        // Extract the two socket IDs from a normalized private room name
        // Format: private:socketId1:socketId2
        const parts = roomName.split(':');
        if (parts.length !== 3 || parts[0] !== 'private') {
            return [null, null];
        }
        return [parts[1], parts[2]];
    }

    // Called when player switches chain
    updatePlayerChain(socketId, newChainId) {
        const player = this.players.get(socketId);
        if (!player) return;

        const oldChainId = player.chainId;
        player.chainId = newChainId;

        // Server-side room management (optional, can be client-driven)
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
            if (oldChainId) {
                socket.leave(`chain:${oldChainId}`);
            }
            socket.join(`chain:${newChainId}`);
        }
    }
}
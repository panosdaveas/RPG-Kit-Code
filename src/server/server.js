import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ChatHandler } from './ChatHandler.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"]
    }
});

// Track all connected players
const players = new Map();

const chatHandler = new ChatHandler(io);

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Send existing players to the new player
    socket.emit('existing-players', Array.from(players.values()));

    // Add new player to the map
    players.set(socket.id, {
        id: socket.id,
        x: 560, // default starting position
        y: 400,
        animation: 'standDown',
        facingDirection: 'DOWN',
        attributes: {}, // Empty attributes initially
        levelId: 'cave'
    });

    // Notify all other players about the new player
    socket.broadcast.emit('player-joined', {
        id: socket.id,
        x: 560,
        y: 400,
        animation: 'standDown',
        facingDirection: 'DOWN',
        attributes: {}, // Empty attributes initially
        levelId: 'cave'
    });

    // Listen for player state updates
    socket.on('player-update', (data) => {
        // Update player data
        players.set(socket.id, {
            id: socket.id,
            ...data
        });

        // Broadcast to all other players
        socket.broadcast.emit('player-moved', {
            id: socket.id,
            ...data
        });
    });

    // Update stored player attributes
    socket.on('attribute-update', (data) => {
        const player = players.get(socket.id);
        if (player) {
            player.attributes = data.attributes;
        }

        // Broadcast to others
        socket.broadcast.emit('player-attributes-changed', {
            id: socket.id,
            attributes: data.attributes
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        players.delete(socket.id);

        // Notify others
        socket.broadcast.emit('player-left', socket.id);
    });

    // Initialize chat handler for this socket
    const playerName = `Player_${socket.id.substring(0, 6)}`;
    chatHandler.handleConnection(socket, socket.id, playerName);

    // When level changes (you likely already emit this)
    socket.on('level-changed', (data) => {
        chatHandler.updatePlayerLevel(socket.id, data.levelId);
    });

});

const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
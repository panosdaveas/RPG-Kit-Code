import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

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

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Send existing players to the new player
    socket.emit('existing-players', Array.from(players.values()));

    // Add new player to the map
    players.set(socket.id, {
        id: socket.id,
        x: 96, // default starting position
        y: 80,
        animation: 'standDown',
        facingDirection: 'DOWN',
        attributes: {} // Empty attributes initially
    });

    // Notify all other players about the new player
    socket.broadcast.emit('player-joined', {
        id: socket.id,
        x: 96,
        y: 80,
        animation: 'standDown',
        facingDirection: 'DOWN',
        attributes: {} // Empty attributes initially
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

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        players.delete(socket.id);

        // Notify others
        socket.broadcast.emit('player-left', socket.id);
    });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
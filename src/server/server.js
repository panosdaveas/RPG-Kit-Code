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
        levelId: 'mainMap'
    });

    // Notify all other players about the new player
    socket.broadcast.emit('player-joined', {
        id: socket.id,
        x: 560,
        y: 400,
        animation: 'standDown',
        facingDirection: 'DOWN',
        attributes: {}, // Empty attributes initially
        levelId: 'mainMap'
    });

    // Listen for player state updates
    socket.on('player-update', (data) => {
        // Update player data
        players.set(socket.id, {
            id: socket.id,
            ...data
        });

        // #future #multiplayer #server #mmo #optimization #performance
        // MMO OPTIMIZATION TODO: Implement spatial filtering for scalability
        //
        // Current approach: Broadcasting to ALL players (works fine for 2-50 players)
        // socket.broadcast.emit() sends to everyone regardless of distance/level
        //
        // For MMO scale (100-1000+ players), implement:
        //
        // #priority-1
        // 1. LEVEL-BASED FILTERING (Priority 1 - Easy win)
        //    Only send updates to players in the same level
        //    Example:
        //    ```
        //    players.forEach((otherPlayer, otherId) => {
        //      if (otherId !== socket.id && otherPlayer.levelId === data.levelId) {
        //        io.to(otherId).emit('player-moved', {...});
        //      }
        //    });
        //    ```
        //
        // #priority-2 #architecture
        // 2. SPATIAL GRID (Priority 2 - Needed for 200+ players per level)
        //    Only send updates to players within viewport range (~1-2 screens)
        //    Divide world into cells (e.g., 512×512px), track which players are in which cells
        //    Only broadcast to players in same cell + adjacent cells
        //
        //    Implementation approach:
        //    - Create SpatialGrid class with Map<cellKey, Set<playerId>>
        //    - Update player's cell on position change
        //    - getNearbyPlayers(playerId) returns only nearby player IDs
        //    - Reduces network traffic from O(n²) to O(n×k) where k = players per cell
        //
        //    Example calculation:
        //    - 500 players total
        //    - 10 players per cell on average
        //    - Each player receives updates for ~10-30 players (adjacent cells)
        //    - vs. 500 updates without filtering (17-50× reduction!)
        //
        // #priority-3 #bandwidth
        // 3. UPDATE RATE THROTTLING (Priority 3 - Further optimization)
        //    Distant players don't need 60Hz updates
        //    - Same cell: 60 FPS (full rate)
        //    - 1 cell away: 30 FPS
        //    - 2 cells away: 15 FPS
        //    - 3+ cells away: 5 FPS or omit entirely
        //
        // See: Level.js (#architecture) for related client-side zone architecture strategy

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
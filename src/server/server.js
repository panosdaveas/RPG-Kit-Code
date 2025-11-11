import 'dotenv/config.js';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ChatHandler } from './ChatHandler.js';
import { OnChainAgent } from './OnChainAgent.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// Track all connected players
const players = new Map();

const chatHandler = new ChatHandler(io);

// Initialize OnChainAgent
let agent = null;
async function initializeAgent() {
    agent = new OnChainAgent();
    await agent.initialize();
}
initializeAgent().catch(err => console.error('Failed to initialize agent:', err));

// API endpoint for agent commands
app.post('/api/agent', async (req, res) => {
    const { command, userAddress, chainId, remotePlayers, playerId } = req.body;

    if (!command || !userAddress) {
        return res.status(400).json({ error: 'Command and userAddress are required' });
    }

    if (!agent) {
        return res.status(500).json({ error: 'Agent not initialized' });
    }

    try {
        const result = await agent.executeCommand(command, userAddress, chainId || 'unknown', remotePlayers || [], playerId);
        res.json(result);
    } catch (error) {
        console.error('Agent error:', error);
        res.status(500).json({ error: error.message });
    }
});

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
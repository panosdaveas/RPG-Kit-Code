import { io } from 'socket.io-client';
import { events } from '../Events.js';

export class MultiplayerManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.playerId = null;
    }

    connect(serverUrl = 'http://localhost:3000') {
        this.socket = io(serverUrl);

        // Connection established
        this.socket.on('connect', () => {
            console.log('Connected to server!');
            this.isConnected = true;
            this.playerId = this.socket.id;
            events.emit('MULTIPLAYER_CONNECTED', this.playerId);
        });

        // Receive existing players when joining
        this.socket.on('existing-players', (players) => {
            console.log('Existing players:', players);
            players.forEach(player => {
                events.emit('REMOTE_PLAYER_JOINED', player);
            });
        });

        // New player joined
        this.socket.on('player-joined', (player) => {
            console.log('Player joined:', player);
            events.emit('REMOTE_PLAYER_JOINED', player);
        });

        // Player moved/updated
        this.socket.on('player-moved', (data) => {
            events.emit('REMOTE_PLAYER_MOVED', data);
        });

        // Player left
        this.socket.on('player-left', (playerId) => {
            console.log('Player left:', playerId);
            events.emit('REMOTE_PLAYER_LEFT', playerId);
        });

        // Disconnection
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            events.emit('MULTIPLAYER_DISCONNECTED');
        });
    }

    // Send local player state to server
    sendPlayerUpdate(data) {
        if (this.isConnected && this.socket) {
            this.socket.emit('player-update', data);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}
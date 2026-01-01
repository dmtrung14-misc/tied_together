const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;
// Auto-reload enabled with nodemon

// Serve static files
app.use(express.static('public'));

// Game state
const rooms = new Map();
const MAX_PLAYERS_PER_ROOM = 2; // Only 2 players!

// Generate random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

class GameRoom {
    constructor(roomId) {
        this.roomId = roomId;
        this.players = new Map();
        this.gameStarted = false;
        this.creatorId = null; // Track room creator
    }

    addPlayer(socketId, playerData) {
        if (this.players.size === 0) {
            this.creatorId = socketId; // First player is creator
        }
        this.players.set(socketId, playerData);
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
        if (this.players.size === 0) {
            return true; // Room is empty
        }
        // If creator leaves, assign new creator
        if (socketId === this.creatorId && this.players.size > 0) {
            this.creatorId = Array.from(this.players.keys())[0];
        }
        return false;
    }

    getPlayers() {
        return Array.from(this.players.values());
    }

    canJoin() {
        return this.players.size < MAX_PLAYERS_PER_ROOM;
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    // Create a new room
    socket.on('create-room', () => {
        const roomId = generateRoomCode();
        const room = new GameRoom(roomId);
        rooms.set(roomId, room);

        // Add creator to room
        const playerData = {
            id: socket.id,
            x: 100,
            y: 500,
            character: null, // Will be selected later
            isCreator: true
        };

        room.addPlayer(socket.id, playerData);
        socket.join(roomId);
        socket.roomId = roomId;

        socket.emit('room-created', {
            roomId: roomId,
            playerId: socket.id,
            players: room.getPlayers(),
            isCreator: true
        });

        console.log(`Room ${roomId} created by ${socket.id}`);
    });

    // Join existing room
    socket.on('join-room', (data) => {
        const roomId = data.roomId;
        
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('room-not-found');
            return;
        }

        if (!room.canJoin()) {
            socket.emit('room-full');
            return;
        }

        // Add player to room
        const playerData = {
            id: socket.id,
            x: 160,
            y: 500,
            character: null,
            isCreator: false
        };

        room.addPlayer(socket.id, playerData);
        socket.join(roomId);
        socket.roomId = roomId;

        // Send joining player the room info
        socket.emit('room-joined', {
            roomId: roomId,
            playerId: socket.id,
            players: room.getPlayers(),
            creatorId: room.creatorId,
            isCreator: false
        });

        // Notify both players with updated list
        io.to(roomId).emit('player-list-updated', {
            players: room.getPlayers(),
            creatorId: room.creatorId
        });

        console.log(`Player ${socket.id} joined room ${roomId}. Players: ${room.players.size}`);
    });

    // Select character
    socket.on('select-character', (data) => {
        const roomId = socket.roomId;
        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (player) {
            player.character = data.character; // 'duck' or 'dog'
            
            io.to(roomId).emit('player-list-updated', {
                players: room.getPlayers(),
                creatorId: room.creatorId
            });
        }
    });

    // Player movement
    socket.on('player-move', (data) => {
        const roomId = socket.roomId;
        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.vx = data.vx;
            player.vy = data.vy;

            socket.to(roomId).emit('player-moved', {
                playerId: socket.id,
                x: data.x,
                y: data.y,
                vx: data.vx,
                vy: data.vy
            });
        }
    });

    // Start game
    socket.on('start-game', () => {
        const roomId = socket.roomId;
        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        // Only creator can start
        if (socket.id !== room.creatorId) {
            socket.emit('not-creator');
            return;
        }

        // Check if both players have selected characters
        let allSelected = true;
        room.players.forEach(player => {
            if (!player.character) {
                allSelected = false;
            }
        });

        if (!allSelected) {
            socket.emit('characters-not-selected');
            return;
        }

        room.gameStarted = true;
        io.to(roomId).emit('game-started');
        console.log(`Game started in room ${roomId}`);
    });
    
    // Restart game
    socket.on('game-restart', () => {
        const roomId = socket.roomId;
        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        // Reset all player positions
        room.players.forEach(player => {
            const index = Array.from(room.players.values()).indexOf(player);
            player.x = 100 + index * 60;
            player.y = 500;
        });

        io.to(roomId).emit('game-restart');
        console.log(`Game restarted in room ${roomId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        const roomId = socket.roomId;
        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        const isEmpty = room.removePlayer(socket.id);
        
        if (isEmpty) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} deleted`);
        } else {
            socket.to(roomId).emit('player-disconnected', socket.id);
            io.to(roomId).emit('player-list-updated', {
                players: room.getPlayers(),
                creatorId: room.creatorId
            });
        }
    });
});

// Helper function (no longer needed for 2 players)
// Characters will be duck or dog

// Start server
http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


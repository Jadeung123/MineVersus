const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const connectDB = require('./mongoose');
const Player = require('./models/Player');
const Game = require('./models/Game');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cors());

// Connect to MongoDB
connectDB();

// Create an HTTP server from Express
const server = http.createServer(app);

// WebSocket server setup
const wss = new WebSocket.Server({ server });

let waitingPlayer = null;

// Helper function to broadcast data to both players
function broadcastToPlayers(player1, player2, message) {
    player1.send(JSON.stringify(message));
    player2.send(JSON.stringify(message));
}

wss.on('connection', (ws) => {
    let opponent = null;
    let boardSize = 5;
    let round = 1;

    // Player connected, waiting for a match
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === "joinQueue") {
            if (waitingPlayer && waitingPlayer !== ws) {
                // Match found
                const player1 = waitingPlayer;
                const player2 = ws;

                player1.opponent = player2;
                player2.opponent = player1;

                player1.send(JSON.stringify({ type: "matchFound", isPlayer1: true, boardSize, round }));
                player2.send(JSON.stringify({ type: "matchFound", isPlayer1: false, boardSize, round }));

                waitingPlayer = null;

                // Set up communication between players
                setupPlayerCommunication(player1, player2, boardSize, round);
                setupPlayerCommunication(player2, player1, boardSize, round);
            } else {
                console.log("No waiting player, adding to queue...");
                waitingPlayer = ws;
            }
        }
    });

    // Handle connection closing
    ws.on('close', () => {
        if (waitingPlayer === ws) {
            waitingPlayer = null;
        }
        if (opponent) {
            opponent.send(JSON.stringify({ type: "opponentLeft" }));
        }
    });

    // Handle connection errors
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

function setupPlayerCommunication(player, opponent, boardSize, round) {
    player.on('message', (message) => {
        const data = JSON.parse(message);

        // Forward move or flag action to the opponent
        if (data.type === "move") {
            opponent.send(message);
        }

        // Handle board cleared logic
        if (data.type === "boardCleared") {
            const damage = 15;
            opponent.send(JSON.stringify({ type: "roundLost", damage }));
            player.send(JSON.stringify({ type: "roundWon", damage }));

            round += 1;
            boardSize += 1;

            resetRoundState(player, opponent);
            player.send(JSON.stringify({ type: "nextRound", boardSize, round }));
            opponent.send(JSON.stringify({ type: "nextRound", boardSize, round }));
        }

        if (data.type === "roundLost") {
            const playerTime = data.time;
            const opponentTime = Date.now() - opponent.startTime;

            const baseDamage = 10;
            const timeMultiplier = 5;
            const timeDifference = Math.abs(playerTime - opponentTime);
            const damage = Math.round(baseDamage + (timeDifference / 1000) * timeMultiplier);

            if (!player.roundLost) {
                player.roundLost = true;
                player.send(JSON.stringify({ type: "applyDamage", damage }));
                opponent.send(JSON.stringify({ type: "roundWon", damage }));

                round += 1;

                resetRoundState(player, opponent);

                boardSize += 1;

                // Start the next round for both players with the same board size and round number
                player.send(JSON.stringify({ type: "nextRound", boardSize, round }));
                opponent.send(JSON.stringify({ type: "nextRound", boardSize, round }));
            }
        }
    });
}

// Function to reset round state for players
function resetRoundState(player, opponent) {
    player.roundLost = false;
    opponent.roundLost = false;
    player.startTime = Date.now();
    opponent.startTime = Date.now();
}

// Start HTTP server along with WebSocket server
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

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
const port = 3000;

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

wss.on('connection', (ws) => {
    let opponent = null;
    let playerStartTime = null;
    let boardSize = 5; // Start with 5x5 board size for both players
    let round = 1; // Initialize round counter

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === "joinQueue") {
            if (waitingPlayer) {
                // Match found
                const player1 = waitingPlayer;
                const player2 = ws;

                player1.send(JSON.stringify({ type: "matchFound", isPlayer1: true, boardSize, round }));
                player2.send(JSON.stringify({ type: "matchFound", isPlayer1: false, boardSize, round }));

                // Set both players as opponents
                player1.opponent = player2;
                player2.opponent = player1;

                // Set the start time for both players
                player1.startTime = Date.now();
                player2.startTime = Date.now();

                waitingPlayer = null;

                // Set up message forwarding between players
                setupPlayerCommunication(player1, player2, boardSize, round);
                setupPlayerCommunication(player2, player1, boardSize, round);
            } else {
                waitingPlayer = ws;
            }
        }
    });

    ws.on('close', () => {
        if (waitingPlayer === ws) {
            waitingPlayer = null;
        }
        if (opponent) {
            opponent.send(JSON.stringify({ type: "opponentLeft" }));
        }
    });
});

function setupPlayerCommunication(player, opponent, boardSize, round) {
    player.on('message', (message) => {
        const data = JSON.parse(message);

        // Broadcast move or flag action to the opponent
        if (data.type === "move") {
            opponent.send(message);
        }

        // Handle board cleared logic (new feature)
        if (data.type === "boardCleared") {
            const damage = 15; // Arbitrary damage value for the losing player
            opponent.send(JSON.stringify({ type: "roundLost", damage }));
            player.send(JSON.stringify({ type: "roundWon", damage }));

            // Increment round and board size for the next round
            round += 1;
            boardSize += 1; // Ensure increment by 1

            // Reset round state and start the next round
            resetRoundState(player, opponent);
            player.send(JSON.stringify({ type: "nextRound", boardSize, round }));
            opponent.send(JSON.stringify({ type: "nextRound", boardSize, round }));
        }

        // Handle round lost logic
        if (data.type === "roundLost") {
            const playerTime = data.time;
            const opponentTime = Date.now() - opponent.startTime;

            // Damage calculation
            const baseDamage = 10;
            const timeMultiplier = 5;
            const timeDifference = Math.abs(playerTime - opponentTime);
            const damage = Math.round(baseDamage + (timeDifference / 1000) * timeMultiplier);

            // Only apply damage once and avoid additional triggers
            if (!player.roundLost) {
                player.roundLost = true;
                player.send(JSON.stringify({ type: "applyDamage", damage }));
                opponent.send(JSON.stringify({ type: "roundWon", damage }));

                // Increment the round counter for both players
                round += 1;

                // Reset the roundLost state for both players
                resetRoundState(player, opponent);

                // Increment the board size for the next round
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

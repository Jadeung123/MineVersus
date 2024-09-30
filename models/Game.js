const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  player1: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  player2: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  player1Board: { type: [Number], required: true },
  player2Board: { type: [Number], required: true },
  turn: { type: String, enum: ['player1', 'player2'], required: true }
});

module.exports = mongoose.model('Game', gameSchema);

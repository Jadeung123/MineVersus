import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://mineversus-a27cf5ba45b1.herokuapp.com'); // Ensure this is your correct URL

const App = () => {
  const [gameState, setGameState] = useState(null);
  const [gameId, setGameId] = useState('game1'); // Example game ID
  const [bombCooldown, setBombCooldown] = useState(false);
  let player1Id, player2Id;

  useEffect(() => {
    socket.emit('joinGame', gameId);

    socket.on('gameUpdate', (state) => {
      setGameState(state);
    });

    return () => {
      socket.off('gameUpdate');
    };
  }, [gameId]);

  const createPlayers = async () => {
    try {
        let response1 = await fetch('/player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Player 1' })
        });

        if (response1.status === 400) {
            console.log('Player 1 already exists.');
            response1 = await fetch('/player/find', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Player 1' })
            });
        }

        const player1 = await response1.json();
        player1Id = player1._id;

        let response2 = await fetch('/player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Player 2' })
        });

        if (response2.status === 400) {
            console.log('Player 2 already exists.');
            response2 = await fetch('/player/find', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Player 2' })
            });
        }

        const player2 = await response2.json();
        player2Id = player2._id;

        console.log('Created or found players with IDs:', player1Id, player2Id);
    } catch (err) {
        console.error('Error creating players:', err.message);
    }
  };


  const startGame = async () => {
    try {
      await createPlayers(); // Ensure players are created

      const response = await fetch('/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player1Id: player1Id, player2Id: player2Id }) // Use actual ObjectIds
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error starting game:', errorText);
        return;
      }

      const game = await response.json();
      setGameId(game._id);
      renderBoards(game);
    } catch (err) {
      console.error('Error starting game:', err.message);
    }
  };

  const handleDropBomb = () => {
    if (!bombCooldown) {
      socket.emit('dropBomb', gameId);
      setBombCooldown(true);
      setTimeout(() => setBombCooldown(false), 5000); // Example 5-second cooldown
    }
  };

  const renderBoards = (game) => {
    console.log('Rendering boards with game data:', game);
    const player1Board = document.getElementById('player1Board');
    const player2Board = document.getElementById('player2Board');

    if (!game.player1Board || !game.player2Board) {
      console.error('Game data is missing board information');
      return;
    }

    player1Board.innerHTML = '';
    game.player1Board.forEach((cell, index) => {
      const cellDiv = document.createElement('div');
      cellDiv.className = 'cell';
      if (cell === 'bomb') cellDiv.classList.add('bomb');
      player1Board.appendChild(cellDiv);
    });

    player2Board.innerHTML = '';
    game.player2Board.forEach((cell, index) => {
      const cellDiv = document.createElement('div');
      cellDiv.className = 'cell';
      if (cell === 'bomb') cellDiv.classList.add('bomb');
      player2Board.appendChild(cellDiv);
    });
  };

  return (
    <div>
      <h1>Minesweeper 1v1</h1>
      <button onClick={startGame}>Start Game</button>
      <button onClick={handleDropBomb} disabled={bombCooldown}>Drop Bomb</button>
      <div id="player1Board" className="board"></div>
      <div id="player2Board" className="board"></div>
    </div>
  );
};

export default App;

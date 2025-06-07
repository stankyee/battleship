const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let players = [];
let playerSockets = {};
let readyPlayers = 0;

io.on('connection', socket => {
  console.log(`Player connected: ${socket.id}`);

  // Assign player to a slot
  if (players.length >= 2) {
    socket.emit('full');
    return;
  }

  players.push(socket.id);
  playerSockets[socket.id] = socket;

  if (players.length === 2) {
    playerSockets[players[0]].emit('start', { yourTurn: true });
    playerSockets[players[1]].emit('start', { yourTurn: false });
  }

  socket.on('ready', () => {
    readyPlayers++;
    socket.broadcast.emit('player-ready');

    if (readyPlayers === 2) {
      // Optionally: start game automatically
    }
  });

  socket.on('start', data => {
    socket.emit('start', data);
    socket.broadcast.emit('start', { yourTurn: !data.yourTurn });
  });

  socket.on('move', data => {
    socket.broadcast.emit('move', data);
  });

  socket.on('move-result', data => {
    socket.broadcast.emit('move-result', data);
  });

  socket.on('game-over', () => {
    socket.broadcast.emit('game-over');
  });

  socket.on('reset', () => {
    console.log('Game reset requested');
    readyPlayers = 0;
    socket.broadcast.emit('game-reset');
    socket.emit('game-reset');
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    players = players.filter(id => id !== socket.id);
    delete playerSockets[socket.id];
    readyPlayers = 0;
    socket.broadcast.emit('game-reset');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

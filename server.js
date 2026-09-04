const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const tmi = require('tmi.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ─── Utilities ───

function normalizeArabic(text) {
  let n = text.trim();
  n = n.replace(/[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g, '');
  n = n.replace(/[أإآٱ]/g, 'ا');
  n = n.replace(/ة/g, 'ه');
  n = n.replace(/ى/g, 'ي');
  n = n.replace(/^ال/, '');
  n = n.toLowerCase();
  return n;
}

function isCorrectAnswer(guess, acceptedAnswers) {
  const normalizedGuess = normalizeArabic(guess);
  return acceptedAnswers.some(ans => normalizeArabic(ans) === normalizedGuess);
}

function generateRoomCode() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms[code]);
  return code;
}

// ─── Room Management ───

const rooms = {};
const socketToRoom = {};

function getPlayerCount(room) {
  return Object.keys(room.players).length;
}

function getScoreboard(room) {
  return Object.values(room.players)
    .map(p => ({ name: p.name, score: p.score, type: p.type }))
    .sort((a, b) => b.score - a.score);
}

function endRound(room) {
  if (room.state !== 'playing') return;
  if (room.timer) { clearInterval(room.timer); room.timer = null; }

  const isLastRound = room.currentRound >= room.settings.rounds;
  room.state = isLastRound ? 'gameOver' : 'roundEnd';

  const data = {
    emojis: room.currentEmojis,
    answer: room.currentAnswers[0],
    winners: room.roundWinners,
    scores: getScoreboard(room)
  };

  io.to(room.code).emit('round-ended', data);

  if (isLastRound) {
    setTimeout(() => {
      io.to(room.code).emit('game-over', { finalScores: getScoreboard(room) });
    }, 500);
  }
}

function startRound(room, { emojis, answers, category }) {
  room.currentRound++;
  room.state = 'playing';
  room.roundWinners = [];
  room.totalAttempts = 0;

  room.currentEmojis = emojis;
  room.currentAnswers = answers;
  room.currentCategory = category || '';
  room.roundStartTime = Date.now();
  room.remaining = room.settings.roundTime;

  const data = {
    roundNumber: room.currentRound,
    totalRounds: room.settings.rounds,
    emojis,
    category: category || '',
    duration: room.settings.roundTime
  };

  io.to(room.code).emit('round-started', data);

  room.timer = setInterval(() => {
    room.remaining--;
    io.to(room.code).emit('timer-tick', { remaining: room.remaining });

    if (room.remaining <= 0) {
      endRound(room);
    }
  }, 1000);
}

function processGuess(room, playerId, guess) {
  if (room.state !== 'playing') return;

  const alreadyWon = room.roundWinners.some(w => w.playerId === playerId);
  if (alreadyWon) return;

  room.totalAttempts++;

  if (isCorrectAnswer(guess, room.currentAnswers)) {
    if (room.roundWinners.length >= 3) return;

    const rank = room.roundWinners.length + 1;
    const points = 4 - rank;
    const elapsed = Math.round((Date.now() - room.roundStartTime) / 1000);

    const player = room.players[playerId];
    if (!player) return;
    player.score += points;

    room.roundWinners.push({
      playerId,
      playerName: player.name,
      rank,
      points,
      timeElapsed: elapsed
    });

    io.to(room.code).emit('correct-answer', {
      playerName: player.name,
      rank,
      points,
      timeElapsed: elapsed
    });

    if (room.roundWinners.length >= 3) {
      setTimeout(() => endRound(room), 1500);
    }
  } else {
    const player = room.players[playerId];
    if (!player) return;

    if (player.socketId) {
      io.to(player.socketId).emit('wrong-guess', { guess });
    }

    if (room.hostSocket) {
      io.to(room.hostSocket).emit('guess-attempt', {
        playerName: player.name,
        guess
      });
    }
  }
}

// ─── Twitch Integration ───

function connectTwitch(room, channel) {
  if (room.twitchClient) {
    room.twitchClient.disconnect().catch(() => {});
  }

  const client = new tmi.Client({
    connection: { reconnect: true, secure: true },
    channels: [channel]
  });

  client.connect().then(() => {
    room.twitchChannel = channel;
    room.twitchClient = client;
    io.to(room.code).emit('twitch-connected', { channel });
  }).catch(() => {
    if (room.hostSocket) {
      io.to(room.hostSocket).emit('twitch-error', { message: 'فشل الاتصال بالقناة' });
    }
  });

  client.on('message', (ch, tags, message, self) => {
    if (self) return;
    const username = tags['display-name'] || tags.username;
    const twitchId = 'twitch:' + username;
    const msg = message.trim();

    if (msg === '!join' || msg === '!انضم') {
      if (!room.players[twitchId]) {
        room.players[twitchId] = {
          id: twitchId,
          name: username,
          type: 'twitch',
          score: 0,
          socketId: null
        };
        io.to(room.code).emit('player-joined', {
          name: username,
          type: 'twitch',
          playerCount: getPlayerCount(room)
        });
      }
      return;
    }

    if (msg === '!leave' || msg === '!انسحب') {
      if (room.players[twitchId]) {
        delete room.players[twitchId];
        io.to(room.code).emit('player-left', {
          name: username,
          playerCount: getPlayerCount(room)
        });
      }
      return;
    }

    if (room.state === 'playing' && room.players[twitchId]) {
      processGuess(room, twitchId, msg);
    }
  });
}

function disconnectTwitch(room) {
  if (room.twitchClient) {
    room.twitchClient.disconnect().catch(() => {});
    room.twitchClient = null;
    room.twitchChannel = null;

    const twitchPlayers = Object.keys(room.players).filter(id => id.startsWith('twitch:'));
    twitchPlayers.forEach(id => delete room.players[id]);

    io.to(room.code).emit('twitch-disconnected');
  }
}

// ─── Socket.IO ───

io.on('connection', (socket) => {

  socket.on('create-room', () => {
    const code = generateRoomCode();
    rooms[code] = {
      code,
      hostSocket: socket.id,
      players: {},
      settings: {
        rounds: 10,
        roundTime: 30
      },
      state: 'lobby',
      currentRound: 0,
      currentEmojis: '',
      currentAnswers: [],
      currentCategory: '',
      roundWinners: [],
      totalAttempts: 0,
      timer: null,
      remaining: 0,
      roundStartTime: 0,
      twitchClient: null,
      twitchChannel: null,
      overlays: new Set()
    };
    socketToRoom[socket.id] = code;
    socket.join(code);
    socket.emit('room-created', { roomCode: code });
  });

  socket.on('update-settings', (data) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    Object.assign(room.settings, data);
    io.to(code).emit('settings-updated', room.settings);
  });

  socket.on('start-round', ({ emojis, answers, category }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    if (room.state === 'lobby' || room.state === 'roundEnd') {
      startRound(room, { emojis, answers, category });
    }
  });

  socket.on('reset-game', () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    if (room.timer) { clearInterval(room.timer); room.timer = null; }
    room.state = 'lobby';
    room.currentRound = 0;
    room.currentEmojis = '';
    room.currentAnswers = [];
    room.currentCategory = '';
    room.roundWinners = [];
    room.totalAttempts = 0;
    Object.values(room.players).forEach(p => p.score = 0);
    io.to(code).emit('game-reset', { scores: getScoreboard(room) });
  });

  socket.on('connect-twitch', ({ channel }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    connectTwitch(room, channel);
  });

  socket.on('disconnect-twitch', () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    disconnectTwitch(room);
  });

  socket.on('join-room', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('join-error', { message: 'الغرفة غير موجودة' });
      return;
    }

    const playerId = socket.id;
    room.players[playerId] = {
      id: playerId,
      name: playerName,
      type: 'web',
      score: 0,
      socketId: socket.id
    };

    socketToRoom[socket.id] = roomCode;
    socket.join(roomCode);

    socket.emit('joined-room', {
      roomCode,
      settings: room.settings,
      state: room.state,
      scores: getScoreboard(room)
    });

    io.to(roomCode).emit('player-joined', {
      name: playerName,
      type: 'web',
      playerCount: getPlayerCount(room)
    });
  });

  socket.on('submit-guess', ({ guess }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room) return;
    processGuess(room, socket.id, guess);
  });

  socket.on('leave-room', () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room) return;

    const player = room.players[socket.id];
    if (player) {
      delete room.players[socket.id];
      socket.leave(code);
      delete socketToRoom[socket.id];
      io.to(code).emit('player-left', {
        name: player.name,
        playerCount: getPlayerCount(room)
      });
    }
  });

  socket.on('join-overlay', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('join-error', { message: 'الغرفة غير موجودة' });
      return;
    }
    room.overlays.add(socket.id);
    socketToRoom[socket.id] = roomCode;
    socket.join(roomCode);
    socket.emit('joined-overlay', {
      settings: room.settings,
      state: room.state,
      scores: getScoreboard(room)
    });
  });

  socket.on('disconnect', () => {
    const code = socketToRoom[socket.id];
    if (!code) return;
    const room = rooms[code];
    if (!room) return;

    if (room.hostSocket === socket.id) {
      if (room.timer) clearInterval(room.timer);
      disconnectTwitch(room);
      io.to(code).emit('room-closed');
      Object.keys(room.players).forEach(id => {
        if (room.players[id].socketId) {
          delete socketToRoom[room.players[id].socketId];
        }
      });
      room.overlays.forEach(id => delete socketToRoom[id]);
      delete rooms[code];
    } else if (room.overlays.has(socket.id)) {
      room.overlays.delete(socket.id);
    } else if (room.players[socket.id]) {
      const name = room.players[socket.id].name;
      delete room.players[socket.id];
      io.to(code).emit('player-left', {
        name,
        playerCount: getPlayerCount(room)
      });
    }

    delete socketToRoom[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

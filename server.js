const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const tmi = require('tmi.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ─── Word Bank ───

const WORDS = {
  easy: [
    'بيت','باب','قلم','كتاب','شمس','قمر','نجم','وردة','سمك','قطة',
    'كلب','شجرة','مطر','بحر','نهر','جبل','قلب','عين','حلم','خبز',
    'أرز','حليب','عسل','ملح','سكر','بيض','تمر','عنب','موز','ضوء',
    'صوت','ريح','ثوب','حذاء','ساعة','مفتاح','طريق','ورق','سيف','درع',
    'برج','جسر','بئر','رمل','حبل','سحاب','لؤلؤ','ثلج','نار','ماء',
    'تفاح','ليمون','قبعة','خاتم','قلعة','صخرة','عشب','غابة','صدف','وطن'
  ],
  medium: [
    'مدرسة','حاسوب','طائرة','سيارة','مكتبة','هاتف','ملعب','مطبخ','حديقة','مطار',
    'جامعة','مطعم','فندق','فراولة','بطيخ','أناناس','رمان','خيار','طماطم','جزر',
    'بطاطس','فلفل','كرسي','طاولة','سرير','مرآة','ستارة','مصباح','حقيبة','مظلة',
    'دفتر','ممحاة','شاشة','نافذة','جدار','أرنب','دجاجة','حصان','غزال','حمامة',
    'نسر','ثعلب','ذئب','نمر','صقر','فيل','مسجد','قصر','نحاس','بركة',
    'شاطئ','جزيرة','حديد','قارب','مرساة','عنكبوت','جمل','طبيب','معلم','شرطة'
  ],
  hard: [
    'تلفزيون','ثلاجة','غسالة','مكنسة','ميكروفون','سماعات','كاميرا','بطارية','فراشة','عصفور',
    'عقرب','سلحفاة','تمساح','زرافة','دلفين','أخطبوط','ديناصور','بركان','شلال','محيط',
    'كوكب','مجرة','صاروخ','غواصة','دراجة','حافلة','سفينة','بوصلة','خريطة','مستشفى',
    'صيدلية','متحف','صحراء','مروحة','شاحن','طابعة','مسطرة','حاسبة','شوكولاتة','بطريق',
    'حرباء','خفاش','كركدن','طاووس','حلزون','تلسكوب','مغناطيس','شمعدان','قيثارة','سنجاب',
    'عندليب','يعسوب','فانوس','دولاب','صندوق','منظار','مفرقعات','صنارة','عنقود','زمرد'
  ]
};

// ─── Utilities ───

function normalizeArabic(text) {
  let n = text.trim();
  n = n.replace(/[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g, '');
  n = n.replace(/[أإآٱ]/g, 'ا');
  n = n.replace(/ة/g, 'ه');
  n = n.replace(/ى/g, 'ي');
  n = n.replace(/^ال/, '');
  return n;
}

function generateRoomCode() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms[code]);
  return code;
}

function pickWord(room) {
  const diff = room.settings.difficulty;
  let pool;
  if (diff === 'mixed') {
    pool = [...WORDS.easy, ...WORDS.medium, ...WORDS.hard];
  } else {
    pool = [...WORDS[diff]];
  }
  const available = pool.filter(w => !room.usedWords.has(w));
  if (available.length === 0) {
    room.usedWords.clear();
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
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
    originalWord: room.currentWord,
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

function startRound(room) {
  room.currentRound++;
  room.state = 'playing';
  room.roundWinners = [];
  room.hintRevealed = false;

  const word = pickWord(room);
  room.currentWord = word;
  room.usedWords.add(word);
  room.roundStartTime = Date.now();
  room.remaining = room.settings.roundTime;

  const data = {
    roundNumber: room.currentRound,
    totalRounds: room.settings.rounds,
    word: word,
    duration: room.settings.roundTime
  };

  io.to(room.code).emit('round-started', data);

  room.timer = setInterval(() => {
    room.remaining--;

    io.to(room.code).emit('timer-tick', { remaining: room.remaining });

    const halfTime = Math.floor(room.settings.roundTime / 2);
    if (room.remaining === halfTime && room.settings.hintEnabled && room.roundWinners.length === 0 && !room.hintRevealed) {
      room.hintRevealed = true;
      io.to(room.code).emit('hint-revealed', { firstLetter: word.charAt(0) });
    }

    if (room.remaining <= 0) {
      endRound(room);
    }
  }, 1000);
}

function processGuess(room, playerId, guess) {
  if (room.state !== 'playing') return;
  if (room.roundWinners.length >= 3) return;

  const normalizedGuess = normalizeArabic(guess);
  const normalizedAnswer = normalizeArabic(room.currentWord);

  if (normalizedGuess === normalizedAnswer) {
    const alreadyWon = room.roundWinners.some(w => w.playerId === playerId);
    if (alreadyWon) return;

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
    if (player && player.socketId) {
      io.to(player.socketId).emit('wrong-guess', { guess });
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
  }).catch(err => {
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

  // Host: create room
  socket.on('create-room', () => {
    const code = generateRoomCode();
    rooms[code] = {
      code,
      hostSocket: socket.id,
      players: {},
      settings: {
        rounds: 10,
        difficulty: 'mixed',
        roundTime: 20,
        hintEnabled: true
      },
      state: 'lobby',
      currentRound: 0,
      currentWord: null,
      roundWinners: [],
      hintRevealed: false,
      usedWords: new Set(),
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

  // Host: update settings
  socket.on('update-settings', (data) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    Object.assign(room.settings, data);
    io.to(code).emit('settings-updated', room.settings);
  });

  // Host: start round
  socket.on('start-round', () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    if (room.state === 'lobby' || room.state === 'roundEnd') {
      startRound(room);
    }
  });

  // Host: next round (alias)
  socket.on('next-round', () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    if (room.state === 'roundEnd') {
      startRound(room);
    }
  });

  // Host: reset game
  socket.on('reset-game', () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    if (room.timer) { clearInterval(room.timer); room.timer = null; }
    room.state = 'lobby';
    room.currentRound = 0;
    room.currentWord = null;
    room.roundWinners = [];
    room.usedWords.clear();
    Object.values(room.players).forEach(p => p.score = 0);
    io.to(code).emit('game-reset', { scores: getScoreboard(room) });
  });

  // Host: connect twitch
  socket.on('connect-twitch', ({ channel }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    connectTwitch(room, channel);
  });

  // Host: disconnect twitch
  socket.on('disconnect-twitch', () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostSocket !== socket.id) return;
    disconnectTwitch(room);
  });

  // Player: join room
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

  // Player: submit guess
  socket.on('submit-guess', ({ guess }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room) return;
    processGuess(room, socket.id, guess);
  });

  // Player: leave room
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

  // Overlay: join
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

  // Disconnect
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

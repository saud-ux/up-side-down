const socket = io();

// ─── DOM refs ───

const screens = {
  lobby:    document.getElementById('lobby-screen'),
  game:     document.getElementById('game-screen'),
  roundEnd: document.getElementById('round-end-screen'),
  gameOver: document.getElementById('gameover-screen')
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function notify(msg, type = '') {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.className = 'notification show ' + type;
  setTimeout(() => el.classList.remove('show'), 2500);
}

const MEDALS = ['🥇','🥈','🥉'];

// ─── Lobby ───

let roomCode = null;

document.getElementById('create-room-btn').addEventListener('click', () => {
  socket.emit('create-room');
});

socket.on('room-created', (data) => {
  roomCode = data.roomCode;
  document.getElementById('room-code').textContent = roomCode;
  document.getElementById('room-code-card').style.display = '';
  document.getElementById('pre-room').style.display = 'none';
  document.getElementById('room-settings').style.display = '';
  SoundFX.join();
});

document.getElementById('copy-link-btn').addEventListener('click', () => {
  const url = location.origin + '/play?room=' + roomCode;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('copy-link-btn');
    btn.textContent = 'تم النسخ!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'نسخ الرابط'; btn.classList.remove('copied'); }, 2000);
  });
});

// Settings
['setting-rounds','setting-difficulty','setting-time'].forEach(id => {
  document.getElementById(id).addEventListener('change', sendSettings);
});
document.getElementById('setting-hint').addEventListener('change', sendSettings);

function sendSettings() {
  socket.emit('update-settings', {
    rounds:      parseInt(document.getElementById('setting-rounds').value),
    difficulty:  document.getElementById('setting-difficulty').value,
    roundTime:   parseInt(document.getElementById('setting-time').value),
    hintEnabled: document.getElementById('setting-hint').checked
  });
}

// Twitch
document.getElementById('twitch-connect-btn').addEventListener('click', () => {
  const channel = document.getElementById('twitch-channel').value.trim();
  if (!channel) return;
  socket.emit('connect-twitch', { channel });
});

document.getElementById('twitch-disconnect-btn').addEventListener('click', () => {
  socket.emit('disconnect-twitch');
});

socket.on('twitch-connected', ({ channel }) => {
  document.getElementById('twitch-connect-area').style.display = 'none';
  document.getElementById('twitch-status-area').style.display = '';
  document.getElementById('twitch-channel-name').textContent = channel;
  notify('متصل بتويتش: ' + channel, 'success');
});

socket.on('twitch-disconnected', () => {
  document.getElementById('twitch-connect-area').style.display = '';
  document.getElementById('twitch-status-area').style.display = 'none';
});

socket.on('twitch-error', ({ message }) => {
  notify(message, 'error');
});

// Players
socket.on('player-joined', ({ name, type, playerCount }) => {
  document.getElementById('player-count').textContent = playerCount;
  renderPlayerChip(name, type);
  document.getElementById('no-players').style.display = playerCount > 0 ? 'none' : '';
  SoundFX.join();
  notify(name + ' انضم', 'success');
});

socket.on('player-left', ({ name, playerCount }) => {
  document.getElementById('player-count').textContent = playerCount;
  removePlayerChip(name);
  document.getElementById('no-players').style.display = playerCount > 0 ? 'none' : '';
});

function renderPlayerChip(name, type) {
  const grid = document.getElementById('players-grid');
  const chip = document.createElement('span');
  chip.className = 'player-chip';
  chip.dataset.name = name;
  chip.innerHTML = '<span class="icon">' + (type === 'twitch' ? '🟣' : '🌐') + '</span>' + name;
  grid.appendChild(chip);
}

function removePlayerChip(name) {
  const grid = document.getElementById('players-grid');
  const chip = grid.querySelector(`[data-name="${name}"]`);
  if (chip) chip.remove();
}

// Start game
document.getElementById('start-game-btn').addEventListener('click', () => {
  sendSettings();
  socket.emit('start-round');
});

// ─── Game ───

let currentRound = 0, totalRounds = 0, duration = 0;

socket.on('round-started', (data) => {
  currentRound = data.roundNumber;
  totalRounds = data.totalRounds;
  duration = data.duration;

  showScreen('game');

  document.getElementById('g-round').textContent = currentRound;
  document.getElementById('g-total').textContent = totalRounds;
  document.getElementById('g-timer').textContent = data.duration;
  document.getElementById('g-timer').className = 'timer';

  document.getElementById('g-word-display').textContent = data.word;
  document.getElementById('g-word-display').className = 'reversed-word';

  document.getElementById('g-hint').textContent = '';
  document.getElementById('g-hint').classList.remove('visible');
  document.getElementById('g-winners').innerHTML = '';
});

socket.on('timer-tick', ({ remaining }) => {
  const timerEl = document.getElementById('g-timer');
  if (timerEl) {
    timerEl.textContent = remaining;
    timerEl.className = 'timer' + (remaining <= 5 ? ' danger' : remaining <= 10 ? ' warning' : '');
    if (remaining <= 5 && remaining > 0) SoundFX.tick();
  }
});

socket.on('hint-revealed', ({ firstLetter }) => {
  const hint = document.getElementById('g-hint');
  hint.textContent = '💡 الحرف الأول: ' + firstLetter;
  hint.classList.add('visible');
  SoundFX.hint();
});

socket.on('correct-answer', ({ playerName, rank, points, timeElapsed }) => {
  SoundFX.correct();
  const winners = document.getElementById('g-winners');
  const item = document.createElement('div');
  item.className = 'winner-item';
  item.innerHTML = `
    <span class="medal">${MEDALS[rank - 1]}</span>
    <span class="name">${playerName}</span>
    <span class="points">+${points}</span>
    <span class="time">${timeElapsed} ث</span>
  `;
  winners.appendChild(item);
});

// ─── Round End ───

socket.on('round-ended', ({ originalWord, winners, scores }) => {
  SoundFX.roundEnd();
  showScreen('roundEnd');

  document.getElementById('re-round').textContent = currentRound;
  document.getElementById('re-total').textContent = totalRounds;
  document.getElementById('re-word').textContent = originalWord;

  const winnersEl = document.getElementById('re-winners');
  winnersEl.innerHTML = '';
  winners.forEach(w => {
    const item = document.createElement('div');
    item.className = 'winner-item';
    item.innerHTML = `
      <span class="medal">${MEDALS[w.rank - 1]}</span>
      <span class="name">${w.playerName}</span>
      <span class="points">+${w.points}</span>
      <span class="time">${w.timeElapsed} ث</span>
    `;
    winnersEl.appendChild(item);
  });

  renderScoreboard('re-scoreboard', scores);

  document.getElementById('next-round-btn').style.display = currentRound >= totalRounds ? 'none' : '';
});

document.getElementById('next-round-btn').addEventListener('click', () => {
  socket.emit('next-round');
});

// ─── Game Over ───

socket.on('game-over', ({ finalScores }) => {
  SoundFX.gameOver();
  showScreen('gameOver');

  const podium = document.getElementById('go-podium');
  podium.innerHTML = '';
  finalScores.slice(0, 3).forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'podium-item';
    item.innerHTML = `
      <div class="podium-medal">${MEDALS[i]}</div>
      <div class="podium-name">${p.name}</div>
      <div class="podium-score">${p.score}</div>
    `;
    podium.appendChild(item);
  });

  renderScoreboard('go-scoreboard', finalScores);
});

document.getElementById('reset-game-btn').addEventListener('click', () => {
  socket.emit('reset-game');
});

socket.on('game-reset', () => {
  showScreen('lobby');
  document.getElementById('players-grid').innerHTML = '';
  document.getElementById('player-count').textContent = '0';
  document.getElementById('no-players').style.display = '';
});

// ─── Room closed ───

socket.on('room-closed', () => {
  notify('الغرفة اتقفلت', 'error');
});

// ─── Helpers ───

function renderScoreboard(id, scores) {
  const ol = document.getElementById(id);
  ol.innerHTML = '';
  scores.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="score-rank">${i + 1}</span>
      <span class="score-name"><span class="score-type">${p.type === 'twitch' ? '🟣' : '🌐'}</span>${p.name}</span>
      <span class="score-value">${p.score}</span>
    `;
    ol.appendChild(li);
  });
}

const socket = io();

const screens = {
  join:         document.getElementById('join-screen'),
  waiting:      document.getElementById('waiting-screen'),
  play:         document.getElementById('play-screen'),
  result:       document.getElementById('result-screen'),
  gameOver:     document.getElementById('player-gameover'),
  disconnected: document.getElementById('disconnected-screen')
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
const RANK_TEXT = ['الأول','الثاني','الثالث'];

let playerName = '';
let myScore = 0;
let currentRound = 0, totalRounds = 0;
let myRoundRank = 0;

// ─── Auto-fill from URL / storage ───

const urlParams = new URLSearchParams(location.search);
if (urlParams.has('room')) {
  document.getElementById('join-code').value = urlParams.get('room');
}
try {
  const savedName = localStorage.getItem('emoji-player-name');
  if (savedName) document.getElementById('join-name').value = savedName;
} catch (e) {}

// ─── Join ───

document.getElementById('join-btn').addEventListener('click', joinRoom);
document.getElementById('join-code').addEventListener('keyup', (e) => { if (e.key === 'Enter') document.getElementById('join-name').focus(); });
document.getElementById('join-name').addEventListener('keyup', (e) => { if (e.key === 'Enter') joinRoom(); });

function joinRoom() {
  const code = document.getElementById('join-code').value.trim();
  const name = document.getElementById('join-name').value.trim();

  if (!code || code.length !== 4) { showError('أدخل كود الغرفة (4 أرقام)'); return; }
  if (!name) { showError('أدخل اسمك'); return; }

  playerName = name;
  try { localStorage.setItem('emoji-player-name', name); } catch (e) {}
  socket.emit('join-room', { roomCode: code, playerName: name });
}

function showError(msg) {
  const el = document.getElementById('join-error');
  el.textContent = msg;
  el.style.display = '';
  setTimeout(() => el.style.display = 'none', 3000);
}

socket.on('join-error', ({ message }) => {
  showError(message);
});

socket.on('joined-room', ({ roomCode, settings, state, scores }) => {
  SoundFX.join();
  document.getElementById('w-name').textContent = playerName;
  showScreen('waiting');
  updateMyScore(scores);
  if (scores && scores.length > 0) {
    document.getElementById('w-scores-card').style.display = '';
    renderScoreboard('w-scoreboard', scores);
  }
});

// ─── Waiting ───

socket.on('player-joined', () => {
  if (screens.waiting.classList.contains('active')) {
    document.getElementById('w-scores-card').style.display = '';
  }
});

// ─── Countdown ───

socket.on('round-countdown', ({ category, count }) => {
  const overlay = document.getElementById('countdown-overlay');
  document.getElementById('countdown-category').textContent = category ? categoryLabel(category) : '';
  document.getElementById('countdown-number').textContent = count;
  overlay.classList.add('show');
  bumpCountdown();
  SoundFX.tick();
});

socket.on('countdown-tick', ({ count }) => {
  document.getElementById('countdown-number').textContent = count;
  bumpCountdown();
  SoundFX.tick();
});

function bumpCountdown() {
  const num = document.getElementById('countdown-number');
  num.classList.remove('pop');
  void num.offsetWidth;
  num.classList.add('pop');
}

// ─── Round ───

socket.on('round-started', (data) => {
  document.getElementById('countdown-overlay').classList.remove('show');

  currentRound = data.roundNumber;
  totalRounds = data.totalRounds;
  myRoundRank = 0;

  showScreen('play');

  document.getElementById('p-round').textContent = currentRound;
  document.getElementById('p-total').textContent = totalRounds;
  document.getElementById('p-timer').textContent = data.duration;
  document.getElementById('p-timer').className = 'timer';

  renderEmojiBoxes(document.getElementById('p-emojis'), data.emojis, 'emoji-large');

  const catEl = document.getElementById('p-category');
  if (data.category) {
    catEl.textContent = categoryLabel(data.category);
    catEl.style.display = '';
  } else {
    catEl.style.display = 'none';
  }

  document.getElementById('p-attempts').innerHTML = '';
  document.getElementById('p-winners').innerHTML = '';

  const input = document.getElementById('guess-input');
  input.value = '';
  input.disabled = false;
  input.focus();
  document.getElementById('guess-btn').disabled = false;
});

socket.on('timer-tick', ({ remaining }) => {
  const el = document.getElementById('p-timer');
  if (!el) return;
  el.textContent = remaining;
  el.className = 'timer' + (remaining <= 5 ? ' danger' : remaining <= 10 ? ' warning' : '');
  if (remaining <= 5 && remaining > 0) SoundFX.tick();
});

// ─── Guess ───

document.getElementById('guess-btn').addEventListener('click', submitGuess);
document.getElementById('guess-input').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') submitGuess();
});

function submitGuess() {
  const input = document.getElementById('guess-input');
  const guess = input.value.trim();
  if (!guess) return;
  socket.emit('submit-guess', { guess });
  input.value = '';
  input.focus();
}

socket.on('wrong-guess', ({ guess }) => {
  SoundFX.wrong();
  const attempts = document.getElementById('p-attempts');
  const span = document.createElement('span');
  span.className = 'attempt wrong';
  span.textContent = '"' + guess + '" ❌';
  attempts.appendChild(span);
});

socket.on('correct-answer', ({ playerName: name, rank, points }) => {
  if (name === playerName) {
    myRoundRank = rank;
    myScore += points;
    SoundFX.correct();
    document.getElementById('guess-input').disabled = true;
    document.getElementById('guess-btn').disabled = true;

    const attempts = document.getElementById('p-attempts');
    const span = document.createElement('span');
    span.className = 'attempt correct';
    span.textContent = MEDALS[rank - 1] + ' إجابة صحيحة! +' + points;
    attempts.appendChild(span);
  }

  const winners = document.getElementById('p-winners');
  const item = document.createElement('div');
  item.className = 'winner-item';
  item.innerHTML = `
    <span class="medal">${MEDALS[rank - 1]}</span>
    <span class="name">${escapeHTML(name)}</span>
    <span class="points">+${points}</span>
  `;
  winners.appendChild(item);
});

// ─── Round End ───

socket.on('round-ended', ({ emojis, answer, winners, scores }) => {
  SoundFX.roundEnd();
  showScreen('result');

  document.getElementById('r-round').textContent = currentRound;
  document.getElementById('r-total').textContent = totalRounds;

  renderEmojiBoxes(document.getElementById('r-emojis'), emojis, 'emoji-small');
  document.getElementById('r-answer').textContent = '= ' + answer;

  const resultEl = document.getElementById('r-result');
  if (myRoundRank > 0) {
    const w = winners.find(w => w.rank === myRoundRank);
    resultEl.innerHTML = `
      <div class="rank-display">${MEDALS[myRoundRank - 1]}</div>
      <div class="points-display">+${w ? w.points : (4 - myRoundRank)} نقاط</div>
      <div class="total-score">مجموعك: ${myScore} نقطة</div>
      <div class="rank-text">ترتيبك: ${RANK_TEXT[myRoundRank - 1]}</div>
    `;
  } else {
    resultEl.innerHTML = `
      <div class="rank-display">😅</div>
      <div class="points-display" style="color:var(--text-dim)">لم تجب</div>
      <div class="total-score">مجموعك: ${myScore} نقطة</div>
    `;
  }

  renderScoreboard('r-scoreboard', scores);
  updateMyScore(scores);
});

// ─── Game Over ───

socket.on('game-over', ({ finalScores }) => {
  SoundFX.gameOver();
  showScreen('gameOver');

  updateMyScore(finalScores);
  const myRank = finalScores.findIndex(s => s.name === playerName) + 1;
  if (myRank >= 1 && myRank <= 3) launchConfetti();

  const resultEl = document.getElementById('pgo-result');
  if (myRank <= 3 && myRank > 0) {
    resultEl.innerHTML = `
      <div class="rank-display">${MEDALS[myRank - 1]}</div>
      <div class="points-display">المركز ${RANK_TEXT[myRank - 1]}!</div>
      <div class="total-score">مجموعك: ${myScore} نقطة</div>
    `;
  } else {
    resultEl.innerHTML = `
      <div class="rank-display">⭐</div>
      <div class="points-display" style="color:var(--text-dim)">المركز ${myRank}</div>
      <div class="total-score">مجموعك: ${myScore} نقطة</div>
    `;
  }

  const podium = document.getElementById('pgo-podium');
  podium.innerHTML = '';
  finalScores.slice(0, 3).forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'podium-item';
    item.innerHTML = `
      <div class="podium-medal">${MEDALS[i]}</div>
      <div class="podium-name">${escapeHTML(p.name)}</div>
      <div class="podium-score">${p.score}</div>
    `;
    podium.appendChild(item);
  });

  renderScoreboard('pgo-scoreboard', finalScores);
});

// ─── Reset / Close ───

socket.on('game-reset', () => {
  myScore = 0;
  showScreen('waiting');
});

socket.on('room-closed', () => {
  showScreen('disconnected');
});

socket.on('disconnect', () => {
  showScreen('disconnected');
});

// ─── Helpers ───

function renderScoreboard(id, scores) {
  const ol = document.getElementById(id);
  if (!ol) return;
  ol.innerHTML = '';
  scores.forEach((p, i) => {
    const li = document.createElement('li');
    const isMe = p.name === playerName;
    li.style.background = isMe ? 'rgba(52,152,219,0.12)' : '';
    li.innerHTML = `
      <span class="score-rank">${i + 1}</span>
      <span class="score-name"><span class="score-type">${p.type === 'twitch' ? '🟣' : '🌐'}</span>${escapeHTML(p.name)}${isMe ? ' (أنت)' : ''}</span>
      <span class="score-value">${p.score}</span>
    `;
    ol.appendChild(li);
  });
}

function updateMyScore(scores) {
  if (!scores) return;
  const me = scores.find(s => s.name === playerName);
  if (me) myScore = me.score;
}

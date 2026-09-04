const socket = io();

const MEDALS = ['🥇','🥈','🥉'];

let totalDuration = 30;
let roomCode = null;
const CIRCUMFERENCE = 2 * Math.PI * 30;

// ─── Overlay emoji rendering (larger boxes) ───

function renderOverlayEmojis(container, emojis) {
  container.innerHTML = '';
  splitEmojis(emojis).forEach(e => {
    const span = document.createElement('span');
    span.className = 'ov-emoji-char';
    span.textContent = e;
    container.appendChild(span);
  });
}

// ─── Auto-fill from URL ───

const urlParams = new URLSearchParams(location.search);
if (urlParams.has('room')) {
  document.getElementById('ov-code').value = urlParams.get('room');
}

// ─── Join ───

document.getElementById('ov-join-btn').addEventListener('click', joinOverlay);
document.getElementById('ov-code').addEventListener('keyup', (e) => { if (e.key === 'Enter') joinOverlay(); });

function joinOverlay() {
  const code = document.getElementById('ov-code').value.trim();
  if (!code || code.length !== 4) return;
  roomCode = code;
  socket.emit('join-overlay', { roomCode: code });
}

socket.on('join-error', () => {
  alert('الغرفة غير موجودة');
});

socket.on('joined-overlay', ({ settings, state, scores }) => {
  document.getElementById('ov-join').style.display = 'none';
  document.getElementById('ov-main').style.display = 'flex';
  totalDuration = settings.roundTime;
  if (scores) renderScores(scores);
});

// ─── Countdown ───

socket.on('round-countdown', ({ roundNumber, totalRounds, category, count }) => {
  document.getElementById('ov-round').textContent = 'الجولة ' + roundNumber + '/' + totalRounds;
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

// ─── Round Start ───

socket.on('round-started', (data) => {
  document.getElementById('countdown-overlay').classList.remove('show');
  totalDuration = data.duration;

  document.getElementById('ov-round').textContent =
    'الجولة ' + data.roundNumber + '/' + data.totalRounds;

  renderOverlayEmojis(document.getElementById('ov-emojis'), data.emojis);

  const catEl = document.getElementById('ov-category');
  if (data.category) {
    catEl.textContent = categoryLabel(data.category);
    catEl.style.display = '';
  } else {
    catEl.style.display = 'none';
  }

  document.getElementById('ov-answer').textContent = '';
  document.getElementById('ov-answer').classList.remove('visible');
  document.getElementById('ov-winners').innerHTML = '';

  document.getElementById('ov-timer-text').textContent = data.duration;
  resetTimerRing();

  const ovGo = document.getElementById('ov-gameover');
  if (ovGo) ovGo.style.display = 'none';
});

// ─── Timer ───

socket.on('timer-tick', ({ remaining }) => {
  document.getElementById('ov-timer-text').textContent = remaining;

  const fraction = remaining / totalDuration;
  const offset = CIRCUMFERENCE * (1 - fraction);
  const circle = document.getElementById('ov-timer-circle');
  circle.style.strokeDashoffset = offset;

  if (remaining <= 5) {
    circle.style.stroke = 'var(--red)';
    SoundFX.tick();
  } else if (remaining <= 10) {
    circle.style.stroke = 'var(--gold)';
  } else {
    circle.style.stroke = 'var(--accent)';
  }
});

function resetTimerRing() {
  const circle = document.getElementById('ov-timer-circle');
  circle.style.strokeDasharray = CIRCUMFERENCE;
  circle.style.strokeDashoffset = '0';
  circle.style.stroke = 'var(--accent)';
}

// ─── Correct Answer ───

socket.on('correct-answer', ({ playerName, rank, points }) => {
  SoundFX.correct();
  const winners = document.getElementById('ov-winners');
  const item = document.createElement('div');
  item.className = 'overlay-winner';
  item.innerHTML = `<span>${MEDALS[rank - 1]}</span><span>${escapeHTML(playerName)}</span><span style="color:var(--green)">+${points}</span>`;
  winners.appendChild(item);
});

// ─── Round End ───

socket.on('round-ended', ({ emojis, answer, scores }) => {
  SoundFX.roundEnd();
  const answerEl = document.getElementById('ov-answer');
  answerEl.textContent = '= ' + answer;
  answerEl.classList.add('visible');
  renderScores(scores);
});

// ─── Game Over ───

socket.on('game-over', ({ finalScores }) => {
  SoundFX.gameOver();
  renderScores(finalScores);
  if (finalScores.length) launchConfetti(3500);

  const ovGo = document.getElementById('ov-gameover');
  ovGo.style.display = 'flex';

  const podium = document.getElementById('ov-podium');
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
});

// ─── Reset / Close ───

socket.on('game-reset', () => {
  document.getElementById('ov-emojis').innerHTML = '';
  document.getElementById('ov-category').textContent = '';
  document.getElementById('ov-round').textContent = '';
  document.getElementById('ov-winners').innerHTML = '';
  document.getElementById('ov-answer').textContent = '';
  document.getElementById('ov-answer').classList.remove('visible');
  document.getElementById('ov-timer-text').textContent = '';
  document.getElementById('ov-scores').innerHTML = '';
  document.getElementById('countdown-overlay').classList.remove('show');
  const ovGo = document.getElementById('ov-gameover');
  if (ovGo) ovGo.style.display = 'none';
});

socket.on('room-closed', () => {
  document.getElementById('ov-main').style.display = 'none';
  document.getElementById('ov-join').style.display = 'flex';
});

// ─── Helpers ───

function renderScores(scores) {
  const container = document.getElementById('ov-scores');
  container.innerHTML = '';
  scores.slice(0, 10).forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'overlay-score-item';
    const prefix = i < 3 ? MEDALS[i] + ' ' : (i + 1) + '. ';
    row.innerHTML = `<span class="os-name">${prefix}${escapeHTML(p.name)}</span><span class="os-val">${p.score}</span>`;
    container.appendChild(row);
  });
}

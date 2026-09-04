const socket = io();

const MEDALS = ['🥇','🥈','🥉'];

let totalDuration = 20;
let roomCode = null;
const CIRCUMFERENCE = 2 * Math.PI * 30;

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

// ─── Round Start ───

socket.on('round-started', (data) => {
  totalDuration = data.duration;

  document.getElementById('ov-round').textContent =
    'الجولة ' + data.roundNumber + '/' + data.totalRounds;

  const wordEl = document.getElementById('ov-word');
  wordEl.textContent = data.word;
  wordEl.className = 'overlay-word';

  document.getElementById('ov-hint').textContent = '';
  document.getElementById('ov-hint').classList.remove('visible');
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

// ─── Hint ───

socket.on('hint-revealed', ({ firstLetter }) => {
  const hint = document.getElementById('ov-hint');
  hint.textContent = '💡 الحرف الأول: ' + firstLetter;
  hint.classList.add('visible');
  SoundFX.hint();
});

// ─── Correct Answer ───

socket.on('correct-answer', ({ playerName, rank, points, timeElapsed }) => {
  SoundFX.correct();
  const winners = document.getElementById('ov-winners');
  const item = document.createElement('div');
  item.className = 'overlay-winner';
  item.innerHTML = `<span>${MEDALS[rank - 1]}</span><span>${playerName}</span><span style="color:var(--green)">+${points}</span>`;
  winners.appendChild(item);
});

// ─── Round End ───

socket.on('round-ended', ({ originalWord, scores }) => {
  SoundFX.roundEnd();

  const wordEl = document.getElementById('ov-word');
  wordEl.textContent = originalWord;
  wordEl.classList.add('revealed');

  renderScores(scores);
});

// ─── Game Over ───

socket.on('game-over', ({ finalScores }) => {
  SoundFX.gameOver();
  renderScores(finalScores);

  const ovGo = document.getElementById('ov-gameover');
  ovGo.style.display = 'flex';

  const podium = document.getElementById('ov-podium');
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
});

// ─── Reset / Close ───

socket.on('game-reset', () => {
  const wordEl = document.getElementById('ov-word');
  wordEl.textContent = '';
  wordEl.className = 'overlay-word';
  document.getElementById('ov-round').textContent = '';
  document.getElementById('ov-winners').innerHTML = '';
  document.getElementById('ov-hint').textContent = '';
  document.getElementById('ov-hint').classList.remove('visible');
  document.getElementById('ov-timer-text').textContent = '';
  document.getElementById('ov-scores').innerHTML = '';
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
    row.innerHTML = `<span class="os-name">${prefix}${p.name}</span><span class="os-val">${p.score}</span>`;
    container.appendChild(row);
  });
}

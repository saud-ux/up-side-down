const socket = io();

// ─── Suggestions Bank ───

const SUGGESTIONS = [
  { emojis: '🦁👑🌍', answer: 'الأسد الملك, أسد الملك, lion king, the lion king', category: 'فيلم' },
  { emojis: '🧊❄️👸', answer: 'فروزن, frozen', category: 'فيلم' },
  { emojis: '🕷️🕸️🦸', answer: 'سبايدر مان, spider man, spiderman', category: 'فيلم' },
  { emojis: '🧞‍♂️🏜️✨', answer: 'علاء الدين, aladdin', category: 'فيلم' },
  { emojis: '🐟🌊👨‍👦', answer: 'نيمو, finding nemo, البحث عن نيمو', category: 'فيلم' },
  { emojis: '🦇🌙🏙️', answer: 'باتمان, batman', category: 'فيلم' },
  { emojis: '👸🐸💋', answer: 'الأميرة والضفدع, princess and the frog', category: 'فيلم' },
  { emojis: '🚗⚡🏁', answer: 'سيارات, كارز, cars', category: 'فيلم' },
  { emojis: '🤖🌍🌱', answer: 'وول إي, wall-e, والي', category: 'فيلم' },
  { emojis: '👻👀🏚️', answer: 'بيت أشباح, haunted house', category: 'فيلم' },
  { emojis: '🐭🧀🐱', answer: 'توم وجيري, tom and jerry', category: 'كرتون' },
  { emojis: '🧽🌊🍍', answer: 'سبونج بوب, spongebob', category: 'كرتون' },
  { emojis: '☕🍵🫖', answer: 'شاي, tea', category: 'مشروب' },
  { emojis: '🍕🧀🔥', answer: 'بيتزا, pizza', category: 'أكل' },
  { emojis: '🍔🥩🍞', answer: 'برجر, burger, hamburger', category: 'أكل' },
  { emojis: '🍚🍛🥘', answer: 'كبسة, kabsa', category: 'أكل' },
  { emojis: '🧇🍯🥞', answer: 'وافل, waffle', category: 'أكل' },
  { emojis: '🍦🥛🍫', answer: 'آيسكريم, ايسكريم, ice cream', category: 'أكل' },
  { emojis: '🏜️🐪☀️', answer: 'صحراء, desert', category: 'مكان' },
  { emojis: '🎓📚🏫', answer: 'مدرسة, school', category: 'مكان' },
  { emojis: '⚽🏟️🏆', answer: 'كرة قدم, كورة, football, soccer', category: 'رياضة' },
  { emojis: '🌙⭐🕌', answer: 'رمضان, ramadan', category: 'مناسبة' },
  { emojis: '✈️🧳🌍', answer: 'سفر, travel', category: 'نشاط' },
  { emojis: '🎮🕹️👾', answer: 'ألعاب فيديو, قيمز, gaming, video games', category: 'نشاط' },
  { emojis: '📱💻🌐', answer: 'تكنولوجيا, تقنية, technology', category: 'موضوع' },
  { emojis: '🏖️🌊☀️', answer: 'بحر, شاطئ, beach', category: 'مكان' },
  { emojis: '🎂🎁🎉', answer: 'عيد ميلاد, birthday', category: 'مناسبة' },
  { emojis: '👨‍🍳🍳🔪', answer: 'طبخ, شيف, cooking, chef', category: 'نشاط' },
  { emojis: '🏋️💪🏃', answer: 'رياضة, جيم, gym, sport', category: 'نشاط' },
  { emojis: '🌺🌸🦋', answer: 'ربيع, spring', category: 'فصل' },
  { emojis: '🎸🎤🎵', answer: 'موسيقى, حفلة, music', category: 'نشاط' },
  { emojis: '🦷🪥😁', answer: 'أسنان, طبيب أسنان, dentist', category: 'صحة' },
  { emojis: '🎪🤡🎈', answer: 'سيرك, circus', category: 'مكان' },
  { emojis: '🏥💉👨‍⚕️', answer: 'مستشفى, hospital', category: 'مكان' },
  { emojis: '📸🖼️🎨', answer: 'تصوير, فن, photography, art', category: 'نشاط' },
  { emojis: '🥐🧈☕', answer: 'كرواسون, croissant, فطور', category: 'أكل' },
];

const CATEGORY_ICONS = {
  'فيلم': '🎬', 'كرتون': '📺', 'مشروب': '☕', 'أكل': '🍽️',
  'مكان': '📍', 'رياضة': '⚽', 'مناسبة': '🎉', 'نشاط': '🎯',
  'موضوع': '💡', 'شخصية': '👤', 'حيوان': '🐾', 'أغنية': '🎵',
  'فصل': '🌿', 'صحة': '🏥'
};

// ─── DOM refs ───

const screens = {
  lobby:    document.getElementById('lobby-screen'),
  setup:    document.getElementById('setup-screen'),
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

// ─── Emoji Helpers ───

function splitEmojis(str) {
  const trimmed = str.trim();
  if (!trimmed) return [];
  if (trimmed.includes(' ')) {
    return trimmed.split(/\s+/).filter(Boolean);
  }
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return [...seg.segment(trimmed)].map(s => s.segment).filter(s => s.trim());
  }
  return [trimmed];
}

function renderEmojiBoxes(container, emojis, cssClass) {
  container.innerHTML = '';
  const parts = splitEmojis(emojis);
  parts.forEach(e => {
    const box = document.createElement('span');
    box.className = 'emoji-char' + (cssClass ? ' ' + cssClass : '');
    box.textContent = e;
    container.appendChild(box);
  });
}

// ─── Lobby ───

let roomCode = null;
let currentRound = 0, totalRounds = 0, duration = 0;
let totalAttempts = 0, correctCount = 0;
let usedSuggestions = new Set();
let suggestionsVisible = 10;

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
['setting-rounds','setting-time'].forEach(id => {
  document.getElementById(id).addEventListener('change', sendSettings);
});

function sendSettings() {
  socket.emit('update-settings', {
    rounds:    parseInt(document.getElementById('setting-rounds').value),
    roundTime: parseInt(document.getElementById('setting-time').value)
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

// Start game → go to round setup
document.getElementById('start-game-btn').addEventListener('click', () => {
  sendSettings();
  totalRounds = parseInt(document.getElementById('setting-rounds').value);
  currentRound = 0;
  usedSuggestions.clear();
  goToSetup();
});

// ─── Round Setup ───

function goToSetup() {
  showScreen('setup');
  document.getElementById('s-round').textContent = currentRound + 1;
  document.getElementById('s-total').textContent = totalRounds;
  document.getElementById('setup-emojis').value = '';
  document.getElementById('setup-answer').value = '';
  document.getElementById('setup-category').value = '';
  suggestionsVisible = 10;
  renderSuggestions();
  document.getElementById('setup-emojis').focus();
}

function renderSuggestions() {
  const list = document.getElementById('suggestions-list');
  list.innerHTML = '';
  const available = SUGGESTIONS.filter((_, i) => !usedSuggestions.has(i));
  const toShow = available.slice(0, suggestionsVisible);

  toShow.forEach(s => {
    const idx = SUGGESTIONS.indexOf(s);
    const row = document.createElement('div');
    row.className = 'suggestion-row';
    const icon = CATEGORY_ICONS[s.category] || '🏷️';
    row.innerHTML = `
      <span class="suggestion-emojis">${s.emojis}</span>
      <span class="suggestion-answer">${s.answer.split(',')[0].trim()}</span>
      <span class="suggestion-category">${icon} ${s.category}</span>
      <button class="btn btn-secondary btn-small suggestion-use-btn" data-idx="${idx}">استخدم</button>
    `;
    list.appendChild(row);
  });

  const moreBtn = document.getElementById('show-more-btn');
  moreBtn.style.display = available.length > suggestionsVisible ? '' : 'none';
}

document.getElementById('suggestions-list').addEventListener('click', (e) => {
  const btn = e.target.closest('.suggestion-use-btn');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx);
  const s = SUGGESTIONS[idx];
  document.getElementById('setup-emojis').value = s.emojis;
  document.getElementById('setup-answer').value = s.answer;
  document.getElementById('setup-category').value = s.category;
  usedSuggestions.add(idx);
  renderSuggestions();
});

document.getElementById('show-more-btn').addEventListener('click', () => {
  suggestionsVisible += 10;
  renderSuggestions();
});

document.getElementById('start-round-btn').addEventListener('click', () => {
  const emojis = document.getElementById('setup-emojis').value.trim();
  const answerStr = document.getElementById('setup-answer').value.trim();
  const category = document.getElementById('setup-category').value.trim();

  if (!emojis) {
    notify('أدخل الإيموجيات', 'error');
    return;
  }
  if (!answerStr) {
    notify('أدخل الجواب الصحيح', 'error');
    return;
  }

  const answers = answerStr.split(',').map(a => a.trim()).filter(Boolean);
  socket.emit('start-round', { emojis, answers, category });
});

// ─── Game ───

socket.on('round-started', (data) => {
  currentRound = data.roundNumber;
  totalRounds = data.totalRounds;
  duration = data.duration;
  totalAttempts = 0;
  correctCount = 0;

  showScreen('game');

  document.getElementById('g-round').textContent = currentRound;
  document.getElementById('g-total').textContent = totalRounds;
  document.getElementById('g-timer').textContent = data.duration;
  document.getElementById('g-timer').className = 'timer';

  renderEmojiBoxes(document.getElementById('g-emojis'), data.emojis);

  const catEl = document.getElementById('g-category');
  if (data.category) {
    const icon = CATEGORY_ICONS[data.category] || '🏷️';
    catEl.textContent = icon + ' ' + data.category;
    catEl.style.display = '';
  } else {
    catEl.style.display = 'none';
  }

  document.getElementById('g-attempts').textContent = '0';
  document.getElementById('g-correct').textContent = '0';

  document.getElementById('medal-1').querySelector('.medal-name').textContent = '—';
  document.getElementById('medal-2').querySelector('.medal-name').textContent = '—';
  document.getElementById('medal-3').querySelector('.medal-name').textContent = '—';
  document.querySelectorAll('.medal-slot').forEach(s => s.classList.remove('won'));

  document.getElementById('g-guesses').innerHTML = '';
  document.getElementById('g-no-guesses').style.display = '';
});

socket.on('timer-tick', ({ remaining }) => {
  const timerEl = document.getElementById('g-timer');
  if (timerEl) {
    timerEl.textContent = remaining;
    timerEl.className = 'timer' + (remaining <= 5 ? ' danger' : remaining <= 10 ? ' warning' : '');
    if (remaining <= 5 && remaining > 0) SoundFX.tick();
  }
});

socket.on('guess-attempt', ({ playerName, guess }) => {
  totalAttempts++;
  document.getElementById('g-attempts').textContent = totalAttempts;
  document.getElementById('g-no-guesses').style.display = 'none';

  const feed = document.getElementById('g-guesses');
  const item = document.createElement('div');
  item.className = 'guess-item wrong';
  item.innerHTML = `<span class="guess-name">${playerName}:</span> <span class="guess-text">"${guess}"</span> ❌`;
  feed.prepend(item);

  if (feed.children.length > 8) feed.lastChild.remove();
});

socket.on('correct-answer', ({ playerName, rank, points, timeElapsed }) => {
  SoundFX.correct();
  totalAttempts++;
  correctCount++;
  document.getElementById('g-attempts').textContent = totalAttempts;
  document.getElementById('g-correct').textContent = correctCount;

  const slot = document.getElementById('medal-' + rank);
  slot.querySelector('.medal-name').textContent = playerName + ' (+' + points + ')';
  slot.classList.add('won');
});

// ─── Round End ───

socket.on('round-ended', ({ emojis, answer, winners, scores }) => {
  SoundFX.roundEnd();
  showScreen('roundEnd');

  document.getElementById('re-round').textContent = currentRound;
  document.getElementById('re-total').textContent = totalRounds;

  renderEmojiBoxes(document.getElementById('re-emojis'), emojis);
  document.getElementById('re-answer').textContent = '= ' + answer;

  const winnersEl = document.getElementById('re-winners');
  winnersEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const w = winners[i];
    const item = document.createElement('div');
    item.className = 'winner-item';
    if (w) {
      item.innerHTML = `
        <span class="medal">${MEDALS[i]}</span>
        <span class="name">${w.playerName}</span>
        <span class="points">+${w.points}</span>
        <span class="time">${w.timeElapsed} ث</span>
      `;
    } else {
      item.innerHTML = `<span class="medal">${MEDALS[i]}</span> <span class="name" style="color:var(--text-dim)">لا أحد</span>`;
    }
    winnersEl.appendChild(item);
  }

  renderScoreboard('re-scoreboard', scores);

  document.getElementById('next-round-btn').style.display = currentRound >= totalRounds ? 'none' : '';
});

document.getElementById('next-round-btn').addEventListener('click', () => {
  goToSetup();
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
  usedSuggestions.clear();
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

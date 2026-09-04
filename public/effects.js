// ─── Shared visual + safety helpers ───

function escapeHTML(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function launchConfetti(duration = 2600) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#e67e22', '#2ecc71', '#3498db', '#f1c40f', '#e74c3c', '#9b59b6', '#1abc9c'];
  const pieces = [];
  const count = Math.min(160, Math.floor(canvas.width / 8));

  for (let i = 0; i < count; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      w: 6 + Math.random() * 7,
      h: 9 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: -2.5 + Math.random() * 5,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vr: -0.25 + Math.random() * 0.5
    });
  }

  const start = Date.now();
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (Date.now() - start < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  frame();
}

// ─── Shared emoji splitting ───

function splitEmojis(str) {
  const trimmed = String(str || '').trim();
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
  splitEmojis(emojis).forEach(e => {
    const box = document.createElement('span');
    box.className = 'emoji-char' + (cssClass ? ' ' + cssClass : '');
    box.textContent = e;
    container.appendChild(box);
  });
}

// ─── Shared category icons ───

const CATEGORY_ICONS = {
  'فيلم': '🎬', 'كرتون': '📺', 'مسلسل': '📺', 'مشروب': '☕', 'أكل': '🍽️',
  'مكان': '📍', 'رياضة': '⚽', 'مناسبة': '🎉', 'نشاط': '🎯',
  'موضوع': '💡', 'شخصية': '👤', 'حيوان': '🐾', 'أغنية': '🎵',
  'فصل': '🌿', 'صحة': '🏥', 'لعبة': '🎮'
};

function categoryLabel(cat) {
  if (!cat) return '';
  const icon = CATEGORY_ICONS[cat] || '🏷️';
  return icon + ' ' + cat;
}

const SoundFX = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.15) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + dur);
    } catch(e) {}
  }

  return {
    correct() {
      tone(523, 0.12);
      setTimeout(() => tone(659, 0.2), 80);
    },
    wrong() {
      tone(200, 0.12, 'square', 0.06);
    },
    tick() {
      tone(900, 0.03, 'sine', 0.08);
    },
    hint() {
      tone(440, 0.15);
      setTimeout(() => tone(554, 0.25), 100);
    },
    roundEnd() {
      tone(523, 0.15);
      setTimeout(() => tone(659, 0.15), 80);
      setTimeout(() => tone(784, 0.3), 160);
    },
    gameOver() {
      tone(523, 0.12);
      setTimeout(() => tone(659, 0.12), 100);
      setTimeout(() => tone(784, 0.12), 200);
      setTimeout(() => tone(1047, 0.4), 300);
    },
    join() {
      tone(600, 0.1, 'sine', 0.08);
    }
  };
})();

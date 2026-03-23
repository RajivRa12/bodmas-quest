/* ═══════════════════════════════════════════════════════
   audio.js — Web Audio API sound engine
   No external files needed; all sounds are synthesized.
═══════════════════════════════════════════════════════ */

const AudioEngine = (() => {
  let ctx = null;
  let muted = false;

  // Lazily create the AudioContext on first use (browser autoplay policy)
  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (needed after user hasn't interacted yet)
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /**
   * Play a simple synthesized beep/tone.
   * @param {object} opts - { freq, type, duration, gainStart, gainEnd, delay }
   */
  function playTone({ freq = 440, type = 'sine', duration = 0.15,
                       gainStart = 0.4, gainEnd = 0, delay = 0 } = {}) {
    if (muted) return;
    try {
      const ac = getCtx();
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = type;
      const start = ac.currentTime + delay;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(gainStart, start);
      gain.gain.exponentialRampToValueAtTime(gainEnd || 0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration + 0.01);
    } catch (_) { /* silently fail if audio unavailable */ }
  }

  /* ── Preset sounds ──────────────────────────────── */
  const sounds = {
    correct() {
      // Happy ascending chime
      playTone({ freq: 523, type: 'triangle', duration: 0.12 });
      playTone({ freq: 659, type: 'triangle', duration: 0.12, delay: 0.1 });
      playTone({ freq: 784, type: 'triangle', duration: 0.2,  delay: 0.2 });
    },
    wrong() {
      // Low thud
      playTone({ freq: 220, type: 'sawtooth', duration: 0.25, gainStart: 0.3 });
      playTone({ freq: 180, type: 'sawtooth', duration: 0.2,  gainStart: 0.2, delay: 0.08 });
    },
    click() {
      playTone({ freq: 600, type: 'square', duration: 0.06, gainStart: 0.15 });
    },
    tick() {
      playTone({ freq: 1200, type: 'square', duration: 0.04, gainStart: 0.08 });
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((f, i) => {
        playTone({ freq: f, type: 'triangle', duration: 0.18, gainStart: 0.35, delay: i * 0.12 });
      });
    },
    gameOver() {
      [440, 370, 330, 262].forEach((f, i) => {
        playTone({ freq: f, type: 'sawtooth', duration: 0.22, gainStart: 0.25, delay: i * 0.15 });
      });
    },
    timerWarn() {
      playTone({ freq: 880, type: 'square', duration: 0.07, gainStart: 0.12 });
    }
  };

  function play(name) {
    if (sounds[name]) sounds[name]();
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  function isMuted() { return muted; }

  return { play, toggleMute, isMuted };
})();

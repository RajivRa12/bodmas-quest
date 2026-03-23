/* ═══════════════════════════════════════════════════════
   particles.js — Background floating particle system
═══════════════════════════════════════════════════════ */

const ParticleSystem = (() => {
  const canvas = document.getElementById('particle-canvas');
  const ctx    = canvas.getContext('2d');
  let   particles = [];
  let   animFrame;

  const COLORS = [
    'rgba(124,58,237,', // violet
    'rgba(6,182,212,',  // cyan
    'rgba(245,158,11,', // amber
    'rgba(34,197,94,',  // green
    'rgba(236,72,153,'  // pink
  ];

  class Particle {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x  = Math.random() * canvas.width;
      this.y  = initial ? Math.random() * canvas.height : canvas.height + 10;
      this.r  = Math.random() * 2.5 + 0.5;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -(Math.random() * 0.6 + 0.2);
      this.alpha = Math.random() * 0.5 + 0.1;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.decay = Math.random() * 0.001 + 0.0005;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= this.decay;
      if (this.alpha <= 0 || this.y < -10) this.reset(false);
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color + this.alpha + ')';
      ctx.fill();
    }
  }

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function init() {
    resize();
    particles = Array.from({ length: 80 }, () => new Particle());
    window.addEventListener('resize', resize);
    loop();
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    animFrame = requestAnimationFrame(loop);
  }

  return { init };
})();

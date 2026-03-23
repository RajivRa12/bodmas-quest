/* ═══════════════════════════════════════════════════════
   confetti.js — Canvas confetti burst for win states
═══════════════════════════════════════════════════════ */

const ConfettiEngine = (() => {
  const canvas  = document.getElementById('confetti-canvas');
  const ctx     = canvas.getContext('2d');
  let   pieces  = [];
  let   animRef = null;

  const COLORS = [
    '#f59e0b','#ec4899','#06b6d4',
    '#8b5cf6','#22c55e','#ef4444',
    '#60a5fa','#fbbf24'
  ];

  class Piece {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height * 0.4 - canvas.height * 0.2;
      this.w = Math.random() * 10 + 4;
      this.h = Math.random() * 6 + 3;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.vx = (Math.random() - 0.5) * 6;
      this.vy = Math.random() * 4 + 2;
      this.rot = Math.random() * Math.PI * 2;
      this.rotV = (Math.random() - 0.5) * 0.2;
      this.alpha = 1;
    }
    update() {
      this.x   += this.vx;
      this.y   += this.vy;
      this.vy  += 0.08; // gravity
      this.rot += this.rotV;
      if (this.y > canvas.height) this.alpha = 0;
      else this.alpha = Math.max(0, 1 - this.y / canvas.height);
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
    }
  }

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function burst(count = 120) {
    resize();
    pieces = Array.from({ length: count }, () => new Piece());
    if (animRef) cancelAnimationFrame(animRef);
    loop();
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces = pieces.filter(p => p.alpha > 0.01);
    pieces.forEach(p => { p.update(); p.draw(); });
    if (pieces.length > 0) {
      animRef = requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  return { burst };
})();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class Starfield {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = 0;
    this.height = 0;
    this.stars = [];
    this.shootingStars = [];
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.scrollY = 0;
    this.time = 0;
    this.last = 0;
    this.nextShoot = 7 + Math.random() * 8;
    this.raf = 0;
    this.visible = !document.hidden;

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onPointer = this.onPointer.bind(this);
    this.onVisibility = this.onVisibility.bind(this);

    this.resize();
    window.addEventListener('resize', this.resize, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);

    if (REDUCED) {
      this.draw(0);
    } else {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const count = Math.round(
      Math.min(260, Math.max(70, (this.width * this.height) / 7200)),
    );
    const old = this.stars;
    this.stars = Array.from({ length: count }, (_, i) => {
      const previous = old[i];
      return {
        x: previous?.x ?? Math.random(),
        y: previous?.y ?? Math.random(),
        z: previous?.z ?? 0.08 + Math.random() * 0.92,
        size: previous?.size ?? 0.35 + Math.random() * 1.55,
        phase: previous?.phase ?? Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 1.1,
        teal: Math.random() > 0.76,
        bright: Math.random() > 0.9,
      };
    });

    if (REDUCED) this.draw(0);
  }

  onScroll() {
    this.scrollY = window.scrollY || 0;
  }

  onPointer(event) {
    this.pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
    this.pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
  }

  onVisibility() {
    this.visible = !document.hidden;
    if (this.visible && !REDUCED) {
      this.last = performance.now();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  spawnShootingStar() {
    const fromLeft = Math.random() > 0.35;
    const startX = fromLeft
      ? this.width * (0.05 + Math.random() * 0.45)
      : this.width * (0.55 + Math.random() * 0.4);
    const startY = this.height * (0.08 + Math.random() * 0.3);
    const angle = fromLeft ? 0.35 + Math.random() * 0.2 : Math.PI - 0.35 - Math.random() * 0.2;
    const speed = 380 + Math.random() * 320;
    this.shootingStars.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.7 + Math.random() * 0.45,
      length: 80 + Math.random() * 140,
    });
  }

  draw(dt) {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    this.pointer.x += (this.pointer.tx - this.pointer.x) * 0.04;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * 0.04;

    const t = this.time;
    const scrollShift = (this.scrollY * 0.025) % height;

    for (const star of this.stars) {
      const z = star.z;
      const depth = 0.3 + z * 0.7;
      const twinkle = 0.72 + Math.sin(t * star.speed + star.phase) * 0.28;
      const alpha = (0.16 + z * 0.62) * twinkle;
      const x =
        ((star.x * width + this.pointer.x * 22 * z + width) % width);
      const y =
        ((star.y * height + this.pointer.y * 14 * z + scrollShift * depth + height) %
          height);
      const size = star.size * (0.55 + z * 0.9);

      ctx.beginPath();
      ctx.fillStyle = star.teal
        ? `rgba(100, 244, 223, ${alpha})`
        : star.bright
          ? `rgba(214, 240, 248, ${alpha})`
          : `rgba(150, 188, 205, ${alpha})`;
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      if (star.bright && z > 0.65) {
        ctx.beginPath();
        ctx.fillStyle = star.teal
          ? `rgba(100, 244, 223, ${alpha * 0.12})`
          : `rgba(180, 225, 240, ${alpha * 0.1})`;
        ctx.arc(x, y, size * 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = this.shootingStars.length - 1; i >= 0; i -= 1) {
      const shot = this.shootingStars[i];
      shot.life += dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      const progress = shot.life / shot.maxLife;
      if (progress >= 1) {
        this.shootingStars.splice(i, 1);
        continue;
      }
      const fade = Math.sin(Math.min(1, progress) * Math.PI);
      const tailX = shot.x - shot.vx * 0.16;
      const tailY = shot.y - shot.vy * 0.16;
      const gradient = ctx.createLinearGradient(tailX, tailY, shot.x, shot.y);
      gradient.addColorStop(0, 'rgba(100, 244, 223, 0)');
      gradient.addColorStop(0.7, `rgba(100, 244, 223, ${0.4 * fade})`);
      gradient.addColorStop(1, `rgba(230, 255, 252, ${0.9 * fade})`);
      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(shot.x, shot.y);
      ctx.stroke();
    }
  }

  frame(now) {
    if (!this.visible) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.time += dt;
    this.nextShoot -= dt;
    if (this.nextShoot <= 0) {
      this.spawnShootingStar();
      this.nextShoot = 7 + Math.random() * 10;
    }
    this.draw(dt);
    this.raf = requestAnimationFrame(this.frame);
  }
}

const canvases = document.querySelectorAll('[data-starfield]');
canvases.forEach((canvas) => new Starfield(canvas));

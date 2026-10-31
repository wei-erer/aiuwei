const TAU = Math.PI * 2;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

export class NeuralCore {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = {
      nodeCount: 128,
      interactive: true,
      intensity: 1,
      ...options,
    };

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = 0;
    this.height = 0;
    this.cx = 0;
    this.cy = 0;
    this.radius = 0;

    this.nodes = [];
    this.pairs = [];
    this.pulses = [];

    this.time = 0;
    this.last = 0;
    this.raf = 0;
    this.running = false;
    this.visible = true;
    this.convergence = options.convergence ?? 1;
    this.opacity = options.opacity ?? 1;
    this.pulseEnergy = 0;

    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.rect = null;

    this.frame = this.frame.bind(this);
    this.resize = this.resize.bind(this);
    this.onPointer = this.onPointer.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onVisibility = this.onVisibility.bind(this);

    this.build();
    this.resize();

    if (this.options.interactive && finePointer) {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
      window.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
      this.canvas.addEventListener('pointerdown', () => this.pulse(1));
    }
    window.addEventListener('resize', this.resize, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);

    if (prefersReduced) {
      this.draw(1.15);
    }
  }

  build() {
    const count = this.options.nodeCount;
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2;
      const radial = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const x = Math.cos(theta) * radial;
      const z = Math.sin(theta) * radial;

      this.nodes.push({
        x,
        y,
        z,
        ox: x * (1.7 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.9,
        oy: y * (1.7 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.9,
        oz: z * (1.7 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.9,
        size: 0.75 + Math.random() * 1.7,
        phase: Math.random() * TAU,
        speed: 0.35 + Math.random() * 1.15,
        tone: Math.random(),
        bright: Math.random() > 0.84,
      });
    }

    for (let a = 0; a < count; a += 1) {
      for (let b = a + 1; b < count; b += 1) {
        const na = this.nodes[a];
        const nb = this.nodes[b];
        const dx = na.x - nb.x;
        const dy = na.y - nb.y;
        const dz = na.z - nb.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 0.64) {
          this.pairs.push({
            a,
            b,
            phase: Math.random() * TAU,
            tone: Math.random() > 0.82 ? 2 : Math.random() > 0.5 ? 1 : 0,
          });
        }
      }
    }

    for (let i = 0; i < 9; i += 1) {
      this.pulses.push({
        pair: Math.floor(Math.random() * this.pairs.length),
        offset: Math.random(),
        speed: 0.05 + Math.random() * 0.1,
      });
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.rect = rect;
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.cx = this.width / 2;
    this.cy = this.height / 2;
    this.radius = Math.min(this.width, this.height) * 0.34;

    if (prefersReduced) this.draw(1.15);
    else if (!this.running) this.draw(0);
  }

  onPointer(event) {
    if (!this.rect || this.rect.width === 0) return;
    const x = (event.clientX - (this.rect.left + this.rect.width / 2)) / (this.rect.width / 2);
    const y = (event.clientY - (this.rect.top + this.rect.height / 2)) / (this.rect.height / 2);
    this.pointer.tx = clamp(x, -1, 1);
    this.pointer.ty = clamp(y, -1, 1);
  }

  onPointerLeave() {
    this.pointer.tx = 0;
    this.pointer.ty = 0;
  }

  onVisibility() {
    this.visible = !document.hidden;
    if (!this.visible) this.stop();
    else if (!prefersReduced) this.start();
  }

  setConvergence(value) {
    this.convergence = clamp(value, 0, 1);
    if (prefersReduced) this.draw(this.time);
  }

  setOpacity(value) {
    this.opacity = clamp(value, 0, 1);
    if (prefersReduced) this.draw(this.time);
  }

  pulse(strength = 1) {
    this.pulseEnergy = Math.min(1.6, this.pulseEnergy + strength);
  }

  start() {
    if (this.running || prefersReduced) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.time += dt;
    this.pointer.x = lerp(this.pointer.x, this.pointer.tx, 0.04);
    this.pointer.y = lerp(this.pointer.y, this.pointer.ty, 0.04);
    this.pulseEnergy *= 0.955;
    this.draw(dt);
    this.raf = requestAnimationFrame(this.frame);
  }

  draw(_dt) {
    const { ctx, width, height, cx, cy, radius } = this;
    if (!ctx || !width || !height) return;
    ctx.clearRect(0, 0, width, height);

    if (this.opacity <= 0.002) return;

    const t = this.time;
    const rotY = t * 0.075 + this.pointer.x * 0.28;
    const rotX = Math.sin(t * 0.09) * 0.08 + this.pointer.y * 0.2;
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const e = easeOutCubic(this.convergence);
    const breathe = 1 + Math.sin(t * 0.6) * 0.012;
    const focal = 3.1;
    const pulse = this.pulseEnergy;
    const items = new Array(this.nodes.length);

    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];
      let bx = lerp(node.ox, node.x, e) * breathe;
      let by = lerp(node.oy, node.y, e) * breathe;
      let bz = lerp(node.oz, node.z, e) * breathe;

      const x1 = bx * cosY - bz * sinY;
      const z1 = bx * sinY + bz * cosY;
      const y1 = by * cosX - z1 * sinX;
      const z2 = by * sinX + z1 * cosX;

      const perspective = focal / (focal + z2);
      const depth = (z2 + 1.15) / 2.3;
      const sx = cx + x1 * radius * perspective;
      const sy = cy + y1 * radius * perspective;
      const twinkle = 0.72 + Math.sin(t * node.speed + node.phase) * 0.28;

      items[i] = {
        sx,
        sy,
        z: z2,
        depth,
        perspective,
        size: node.size * (0.55 + perspective * 0.72),
        alpha: (0.18 + depth * 0.82) * twinkle,
        tone: node.tone,
        bright: node.bright,
        phase: node.phase,
      };
    }

    ctx.globalCompositeOperation = 'lighter';

    // Central atmosphere
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.3);
    glow.addColorStop(0, `rgba(100, 244, 223, ${0.055 * this.opacity + pulse * 0.035})`);
    glow.addColorStop(0.36, `rgba(46, 196, 182, ${0.025 * this.opacity})`);
    glow.addColorStop(0.7, 'rgba(109, 140, 255, 0.012)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.3, 0, TAU);
    ctx.fill();

    // Orbital rings
    this.drawRings(t);

    // Synapses
    const pairAlphaBase = 0.23 * this.opacity * Math.max(0, (e - 0.35) / 0.65);
    for (const pair of this.pairs) {
      const a = items[pair.a];
      const b = items[pair.b];
      if (!a || !b) continue;
      const dx = a.sx - b.sx;
      const dy = a.sy - b.sy;
      const screenDist = Math.hypot(dx, dy);
      if (screenDist > radius * 0.7 || screenDist < 0.1) continue;

      const wave = 0.7 + Math.sin(t * 0.9 + pair.phase) * 0.3;
      const alpha = pairAlphaBase * wave * (0.4 + (a.depth + b.depth) * 0.3) * (1 - screenDist / (radius * 0.75));
      if (alpha <= 0.004) continue;

      ctx.beginPath();
      ctx.strokeStyle =
        pair.tone === 2
          ? `rgba(109, 140, 255, ${alpha})`
          : pair.tone === 1
            ? `rgba(150, 226, 235, ${alpha})`
            : `rgba(100, 244, 223, ${alpha})`;
      ctx.lineWidth = pair.tone === 2 ? 0.55 : 0.7;
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }

    // Signal pulses travelling along selected synapses
    for (const signal of this.pulses) {
      const pair = this.pairs[signal.pair];
      if (!pair) continue;
      const a = items[pair.a];
      const b = items[pair.b];
      if (!a || !b) continue;
      const progress = (t * signal.speed + signal.offset) % 1;
      const px = lerp(a.sx, b.sx, progress);
      const py = lerp(a.sy, b.sy, progress);
      const alpha = Math.sin(progress * Math.PI) * 0.65 * this.opacity * e;
      if (alpha <= 0.01) continue;
      ctx.beginPath();
      ctx.fillStyle = `rgba(205, 255, 249, ${alpha})`;
      ctx.arc(px, py, 1.1, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = `rgba(100, 244, 223, ${alpha * 0.18})`;
      ctx.arc(px, py, 5.5, 0, TAU);
      ctx.fill();
    }

    // Nodes
    for (const node of items) {
      const alpha = node.alpha * this.opacity;
      if (alpha <= 0.01) continue;
      const size = Math.max(0.55, node.size);
      const color =
        node.tone > 0.88
          ? '109, 140, 255'
          : node.tone < 0.14
            ? '210, 250, 248'
            : '100, 244, 223';

      if (node.bright) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color}, ${alpha * 0.09})`;
        ctx.arc(node.sx, node.sy, size * 4.6, 0, TAU);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(${color}, ${alpha * 0.22})`;
      ctx.arc(node.sx, node.sy, size * 2, 0, TAU);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = `rgba(${color}, ${alpha * 0.92})`;
      ctx.arc(node.sx, node.sy, size * 0.72, 0, TAU);
      ctx.fill();

      if (node.bright) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(240, 255, 252, ${alpha})`;
        ctx.arc(node.sx, node.sy, size * 0.3, 0, TAU);
        ctx.fill();
      }
    }

    // Core singularity
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(18, radius * 0.2));
    core.addColorStop(0, `rgba(245, 255, 253, ${0.8 * this.opacity * (0.55 + pulse * 0.3)})`);
    core.addColorStop(0.08, `rgba(100, 244, 223, ${0.42 * this.opacity})`);
    core.addColorStop(0.4, `rgba(46, 196, 182, ${0.08 * this.opacity})`);
    core.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(18, radius * 0.2), 0, TAU);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
  }

  drawRings(t) {
    const { ctx, cx, cy, radius, opacity } = this;
    if (opacity <= 0.01) return;
    const rings = [
      { scale: 1.18, squash: 0.25, speed: 0.055, phase: 0.3, dash: [1, 7], tone: '100, 244, 223' },
      { scale: 1.34, squash: 0.32, speed: -0.04, phase: 1.7, dash: [1, 10], tone: '109, 140, 255' },
      { scale: 1.5, squash: 0.21, speed: 0.028, phase: 3.2, dash: [16, 22], tone: '100, 244, 223' },
    ];

    for (const ring of rings) {
      const angle = t * ring.speed + ring.phase;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${ring.tone}, ${0.14 * opacity})`;
      ctx.lineWidth = 0.7;
      ctx.setLineDash(ring.dash);
      ctx.ellipse(0, 0, radius * ring.scale, radius * ring.scale * ring.squash, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();

      const sx = cx + Math.cos(angle) * radius * ring.scale;
      const sy = cy + Math.sin(angle) * radius * ring.scale * ring.squash;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${ring.tone}, ${0.55 * opacity})`;
      ctx.arc(sx, sy, 1.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = `rgba(${ring.tone}, ${0.08 * opacity})`;
      ctx.arc(sx, sy, 6, 0, TAU);
      ctx.fill();
    }

    ctx.setLineDash([]);
  }
}

export function initNeuralCore() {
  const mounts = document.querySelectorAll('[data-neural-core]');
  mounts.forEach((mount) => {
    const canvas = mount.querySelector('canvas');
    if (!canvas) return;
    const count = Number(mount.dataset.nodes) || 128;
    const core = new NeuralCore(canvas, {
      nodeCount: count,
      interactive: mount.dataset.interactive !== 'false',
    });

    const introPending =
      document.body.classList.contains('has-intro') &&
      !document.body.classList.contains('intro-complete');
    let revealed = !introPending;
    let inView = true;

    const maybeStart = () => {
      if (revealed && inView) core.start();
    };

    if (introPending) {
      const onIntroDone = () => {
        revealed = true;
        maybeStart();
      };
      document.addEventListener('aiuwei:intro-complete', onIntroDone, { once: true });
      window.setTimeout(() => {
        if (!revealed) {
          revealed = true;
          maybeStart();
        }
      }, 9000);
    } else {
      maybeStart();
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            inView = entry.isIntersecting;
            if (inView) maybeStart();
            else core.stop();
          });
        },
        { threshold: 0.02 },
      );
      observer.observe(mount);
    }
  });
}

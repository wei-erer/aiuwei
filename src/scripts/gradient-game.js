const STORAGE_KEY = 'aiuwei.loss-valley.v1';
const DOMAIN = [-1.15, 1.15];
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const LEVELS = [
  {
    id: 1,
    code: 'LEVEL 01',
    name: 'FIRST LIGHT',
    cn: '第一道信号',
    objective: '一个凸谷。找到既不会太慢、也不会冲过头的步长。',
    start: -0.82,
    target: 0.55,
    tol: 0.045,
    maxSteps: 140,
    par: 72,
    defaultLr: 0.08,
    defaultBeta: 0,
    loss: (x) => 0.08 + 0.32 * (x - 0.55) ** 2,
    hints: [
      '从一个中等步长开始。太小会走得很慢，太大则会在谷底来回振荡。',
      '目标在右侧。先把 η 放在 0.08 左右，β 保持 0，观察它如何靠近。',
      '接近谷底时把 η 降到 0.02 左右，让球停下来。',
    ],
  },
  {
    id: 2,
    code: 'LEVEL 02',
    name: 'FALSE VALLEY',
    cn: '假谷',
    objective: '左侧有一个浅坑。低动量会让你停在里面，误以为已经收敛。',
    start: -0.85,
    target: 0.68,
    tol: 0.045,
    maxSteps: 180,
    par: 95,
    defaultLr: 0.04,
    defaultBeta: 0,
    loss: (x) =>
      0.06 +
      0.3 * (x - 0.68) ** 2 -
      0.13 * Math.exp(-((x + 0.18) ** 2) / (2 * 0.12 ** 2)),
    hints: [
      '左侧的浅坑会困住低动量。别急着宣布收敛。',
      '在接近坑底时把 β 提到 0.85 以上，动量会带你翻过山脊。',
      '越过山脊后降低 η，否则你会在真正的谷底冲过头。',
    ],
  },
  {
    id: 3,
    code: 'LEVEL 03',
    name: 'THE RAVINE',
    cn: '窄谷',
    objective: '陡坡、平台与窄谷。先稳住步长，再借一点动量穿过平台。',
    start: -0.9,
    target: 0.8,
    tol: 0.04,
    maxSteps: 200,
    par: 108,
    defaultLr: 0.05,
    defaultBeta: 0.5,
    loss: (x) =>
      0.1 +
      0.42 * (x - 0.8) ** 2 +
      0.11 * Math.exp(-((x - 0.1) ** 2) / (2 * 0.22 ** 2)) -
      0.07 * Math.exp(-((x - 0.1) ** 2) / (2 * 0.07 ** 2)),
    hints: [
      '坡度更陡。大 η 会让参数直接飞出地图。',
      '平台区域几乎没有梯度；保持动量，别让球停在那里。',
      '目标谷很窄。进入前把 η 降到 0.02 左右，用 β≈0.6 稳住。',
    ],
  },
];

function grad(level, x) {
  const eps = 1e-5;
  return (level.loss(x + eps) - level.loss(x - eps)) / (2 * eps);
}

function pad(value, length = 3) {
  return String(value).padStart(length, '0');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class LossValley {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('[data-game-canvas]');
    this.wrap = root.querySelector('[data-game-canvas-wrap]');
    if (!this.canvas || !this.wrap) return;
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = 0;
    this.H = 0;
    this.geometry = null;
    this.levelIndex = 0;
    this.unlocked = 1;
    this.best = {};
    this.running = false;
    this.status = 'idle';
    this.raf = 0;
    this.lastTs = 0;
    this.acc = 0;
    this.stepMs = REDUCED ? 32 : 52;
    this.trail = [];
    this.burst = [];
    this.stalled = 0;
    this.inZone = 0;
    this.attempts = 0;
    this.hintIndex = 0;
    this.loadStore();
    this.bind();
    this.loadLevel(0);
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.wrap);
  }

  get level() {
    return LEVELS[this.levelIndex];
  }

  loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Number.isFinite(parsed?.unlocked)) {
        this.unlocked = clamp(parsed.unlocked, 1, LEVELS.length);
      }
      if (parsed?.best && typeof parsed.best === 'object') {
        this.best = parsed.best;
      }
    } catch {
      /* localStorage may be blocked in private windows. */
    }
  }

  saveStore() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ unlocked: this.unlocked, best: this.best }),
      );
    } catch {
      /* Ignore quota / privacy errors. */
    }
  }

  bind() {
    this.runButton = this.root.querySelector('[data-game-run]');
    this.resetButton = this.root.querySelector('[data-game-reset]');
    this.hintButton = this.root.querySelector('[data-game-hint]');
    this.nextButton = this.root.querySelector('[data-game-next]');
    this.lrInput = this.root.querySelector('[data-game-lr]');
    this.betaInput = this.root.querySelector('[data-game-beta]');
    this.lrOutput = this.root.querySelector('[data-game-lr-value]');
    this.betaOutput = this.root.querySelector('[data-game-beta-value]');
    this.statusEl = this.root.querySelector('[data-game-status]');
    this.messageEl = this.root.querySelector('[data-game-message]');
    this.liveEl = this.root.querySelector('[data-game-live]');
    this.hintEl = this.root.querySelector('[data-game-hint-text]');
    this.levelCodeEl = this.root.querySelector('[data-game-level-code]');
    this.levelNameEl = this.root.querySelector('[data-game-level-name]');
    this.levelCnEl = this.root.querySelector('[data-game-level-cn]');
    this.objectiveEl = this.root.querySelector('[data-game-objective]');
    this.stepEl = this.root.querySelector('[data-game-step]');
    this.totalEl = this.root.querySelector('[data-game-total]');
    this.lossEl = this.root.querySelector('[data-game-loss]');
    this.velocityEl = this.root.querySelector('[data-game-velocity]');
    this.attemptEl = this.root.querySelector('[data-game-attempt]');
    this.bestEl = this.root.querySelector('[data-game-best]');
    this.starsEl = this.root.querySelector('[data-game-stars]');
    this.levelButtons = [...this.root.querySelectorAll('[data-level-button]')];

    this.runButton?.addEventListener('click', () => this.toggleRun());
    this.resetButton?.addEventListener('click', () => this.reset());
    this.hintButton?.addEventListener('click', () => this.nextHint());
    this.nextButton?.addEventListener('click', () => {
      if (this.levelIndex < LEVELS.length - 1) this.loadLevel(this.levelIndex + 1);
    });

    this.lrInput?.addEventListener('input', () => this.updateSliders());
    this.betaInput?.addEventListener('input', () => this.updateSliders());

    this.levelButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        if (index + 1 > this.unlocked) return;
        this.loadLevel(index);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, button, textarea, select, a')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        this.toggleRun();
      } else if (event.key === 'r' || event.key === 'R') {
        this.reset();
      } else if (event.key === 'h' || event.key === 'H') {
        this.nextHint();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.running) this.pause();
    });
  }

  loadLevel(index) {
    if (index < 0 || index >= LEVELS.length || index + 1 > this.unlocked) return;
    this.stop();
    this.levelIndex = index;
    this.status = 'idle';
    this.running = false;
    this.attempts = 0;
    this.hintIndex = 0;
    this.resetState();
    this.setSliders(this.level.defaultLr, this.level.defaultBeta);
    this.levelCodeEl.textContent = this.level.code;
    this.levelNameEl.textContent = this.level.name;
    this.levelCnEl.textContent = this.level.cn;
    this.objectiveEl.textContent = this.level.objective;
    this.totalEl.textContent = pad(this.level.maxSteps, 3);
    this.showHint(this.level.hints[0]);
    this.updateLevelButtons();
    this.setStatus('idle', 'READY // 等待参数');
    this.updateUI();
    this.measure();
    this.draw();
    this.root.classList.remove('is-success', 'is-failed', 'is-running', 'is-paused');
    this.nextButton?.classList.remove('is-visible');
  }

  resetState() {
    this.x = this.level.start;
    this.v = 0;
    this.steps = 0;
    this.inZone = 0;
    this.stalled = 0;
    this.trail = [{ x: this.x, v: 0 }];
    this.burst = [];
    this.lastLoss = this.level.loss(this.x);
  }

  setSliders(lr, beta) {
    this.lr = lr;
    this.beta = beta;
    if (this.lrInput) this.lrInput.value = String(lr);
    if (this.betaInput) this.betaInput.value = String(beta);
    this.updateSliders();
  }

  updateSliders() {
    this.lr = Number(this.lrInput?.value ?? this.level.defaultLr);
    this.beta = Number(this.betaInput?.value ?? this.level.defaultBeta);
    if (this.lrOutput) this.lrOutput.textContent = `η ${this.lr.toFixed(3)}`;
    if (this.betaOutput) this.betaOutput.textContent = `β ${this.beta.toFixed(2)}`;
    this.lrInput?.style.setProperty(
      '--fill',
      `${((this.lr - 0.005) / (0.35 - 0.005)) * 100}%`,
    );
    this.betaInput?.style.setProperty('--fill', `${(this.beta / 0.99) * 100}%`);
    if (this.lrInput) {
      this.lrInput.setAttribute('aria-valuetext', `学习率 ${this.lr.toFixed(3)}`);
    }
    if (this.betaInput) {
      this.betaInput.setAttribute('aria-valuetext', `动量 ${this.beta.toFixed(2)}`);
    }
    if (!this.running) this.draw();
  }

  toggleRun() {
    if (this.status === 'success') return;
    if (this.running) {
      this.pause();
      return;
    }
    if (this.status === 'paused') {
      this.resume();
      return;
    }
    this.resetState();
    this.attempts += 1;
    this.status = 'running';
    this.running = true;
    this.root.classList.add('is-running');
    this.root.classList.remove('is-success', 'is-failed', 'is-paused');
    this.setStatus('running', 'DESCENDING // 参数更新中');
    this.updateUI();
    this.lastTs = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame((now) => this.loop(now));
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    this.status = 'paused';
    cancelAnimationFrame(this.raf);
    this.root.classList.remove('is-running');
    this.root.classList.add('is-paused');
    this.setStatus('paused', 'PAUSED // 已暂停');
    this.updateUI();
    this.draw();
  }

  resume() {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.running = true;
    this.root.classList.remove('is-paused');
    this.root.classList.add('is-running');
    this.setStatus('running', 'DESCENDING // 参数更新中');
    this.updateUI();
    this.lastTs = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame((now) => this.loop(now));
  }

  reset() {
    this.stop();
    this.attempts = 0;
    this.status = 'idle';
    this.resetState();
    this.root.classList.remove('is-running', 'is-paused', 'is-success', 'is-failed');
    this.setStatus('idle', 'READY // 等待参数');
    this.nextButton?.classList.remove('is-visible');
    this.updateUI();
    this.draw();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  loop(now) {
    if (!this.running) return;
    const delta = Math.min(100, now - this.lastTs || 0);
    this.lastTs = now;
    this.acc += delta;
    let guard = 0;
    while (this.acc >= this.stepMs && this.running && guard < 4) {
      this.simulateStep();
      this.acc -= this.stepMs;
      guard += 1;
    }
    this.draw();
    this.updateUI();
    if (this.running) this.raf = requestAnimationFrame((next) => this.loop(next));
  }

  simulateStep() {
    const level = this.level;
    this.v = this.beta * this.v - this.lr * grad(level, this.x);
    this.x += this.v;
    this.steps += 1;
    this.trail.push({ x: this.x, v: this.v });
    if (this.trail.length > 460) this.trail.shift();
    const loss = level.loss(this.x);
    this.lastLoss = loss;

    if (Math.abs(this.x - level.target) < level.tol) this.inZone += 1;
    else this.inZone = 0;

    if (this.inZone >= 6) {
      this.succeed();
      return;
    }

    if (!Number.isFinite(this.x) || Math.abs(this.x) > 1.35 || Math.abs(this.v) > 2.4) {
      this.fail('diverged');
      return;
    }

    if (Math.abs(this.v) < 0.0008) this.stalled += 1;
    else this.stalled = 0;

    if (this.stalled === 24) {
      this.messageEl.textContent = 'STALLED // 梯度太小，试试增加动量';
      this.liveEl.textContent = '参数停滞，试试增加动量。';
    }

    if (this.steps >= level.maxSteps) {
      this.fail('timeout');
    }
  }

  succeed() {
    this.stop();
    this.status = 'success';
    this.running = false;
    this.root.classList.remove('is-running', 'is-paused', 'is-failed');
    this.root.classList.add('is-success');

    const stars =
      this.attempts === 1 && this.steps <= this.level.par
        ? 3
        : this.attempts <= 2 && this.steps <= this.level.par * 1.8
          ? 2
          : 1;

    const previous = this.best[this.level.id];
    if (
      !previous ||
      stars > previous.stars ||
      (stars === previous.stars && this.steps < previous.steps)
    ) {
      this.best[this.level.id] = {
        steps: this.steps,
        attempts: this.attempts,
        stars,
      };
    }

    this.unlocked = Math.max(this.unlocked, Math.min(LEVELS.length, this.levelIndex + 2));
    this.saveStore();
    this.updateLevelButtons();
    this.spawnBurst();
    this.setStatus('success', 'CONVERGED // 已收敛');
    this.messageEl.textContent =
      this.levelIndex < LEVELS.length - 1
        ? '参数停在全局最优附近。下一层地形已解锁。'
        : '三层地形全部收敛。你完成了一次完整的调参观测。';
    this.liveEl.textContent =
      this.levelIndex < LEVELS.length - 1
        ? '收敛成功，下一层已解锁。'
        : '收敛成功，全部关卡完成。';
    this.showHint(
      this.levelIndex < LEVELS.length - 1
        ? '漂亮。下一关会更狡猾：试试把动量留在 0.8 以上。'
        : '全部收敛。可以重玩任意关卡，刷新你的最少步数。',
    );
    this.nextButton?.classList.toggle('is-visible', this.levelIndex < LEVELS.length - 1);
    this.updateUI();
    this.draw();
  }

  fail(reason) {
    this.stop();
    this.status = 'failed';
    this.running = false;
    this.root.classList.remove('is-running', 'is-paused', 'is-success');
    this.root.classList.add('is-failed');

    const messages = {
      diverged: 'DIVERGED // 参数飞出了地形',
      timeout: 'TIMEOUT // 步数耗尽',
    };
    const hints = {
      diverged: this.level.hints[0],
      timeout: this.level.hints[2],
    };
    this.setStatus('failed', messages[reason] ?? 'FAILED // 未收敛');
    this.messageEl.textContent =
      reason === 'timeout'
        ? '球还没进入目标谷。检查它是不是停在了浅坑里。'
        : '数值发散了。先把学习率降下来，再重新开始。';
    this.liveEl.textContent = this.messageEl.textContent;
    this.showHint(hints[reason] ?? this.level.hints[0]);
    this.updateUI();
    this.draw();
  }

  setStatus(status, label) {
    this.status = status;
    this.root.dataset.status = status;
    if (this.statusEl) this.statusEl.textContent = label;
    if (this.messageEl) this.messageEl.textContent = label;
    this.updateRunLabel();
  }

  updateRunLabel() {
    const label = this.root.querySelector('[data-run-label]');
    if (!label) return;
    if (this.status === 'running') label.textContent = 'PAUSE';
    else if (this.status === 'paused') label.textContent = 'RESUME';
    else if (this.status === 'success') label.textContent = 'CONVERGED';
    else if (this.status === 'failed') label.textContent = 'RETRY';
    else label.textContent = 'RUN DESCENT';
    if (this.runButton) {
      this.runButton.disabled = this.status === 'success';
      this.runButton.classList.toggle('is-running', this.status === 'running');
    }
    if (this.resetButton) this.resetButton.disabled = this.status === 'idle' && this.steps === 0;
  }

  updateUI() {
    const level = this.level;
    const loss = Number.isFinite(this.x) ? level.loss(this.x) : 0;
    if (this.stepEl) this.stepEl.textContent = pad(this.steps, 3);
    if (this.totalEl) this.totalEl.textContent = pad(level.maxSteps, 3);
    if (this.lossEl) this.lossEl.textContent = loss.toFixed(3);
    if (this.velocityEl) this.velocityEl.textContent = (this.v || 0).toFixed(3);
    if (this.attemptEl) this.attemptEl.textContent = pad(this.attempts, 2);
    const best = this.best[level.id];
    if (this.bestEl) {
      this.bestEl.textContent = best ? `BEST ${pad(best.steps, 3)} STEPS` : 'BEST —';
    }
    if (this.starsEl) {
      const filled = best?.stars ?? 0;
      [...this.starsEl.children].forEach((star, index) => {
        star.classList.toggle('is-filled', index < filled);
      });
    }
    this.updateRunLabel();
    this.canvas.setAttribute(
      'aria-label',
      `损失地形图。当前步数 ${this.steps}，损失 ${loss.toFixed(3)}，参数位置 ${this.x.toFixed(2)}。`,
    );
  }

  updateLevelButtons() {
    this.levelButtons.forEach((button, index) => {
      const locked = index + 1 > this.unlocked;
      button.classList.toggle('is-locked', locked);
      button.classList.toggle('is-active', index === this.levelIndex);
      button.disabled = locked;
      button.setAttribute('aria-pressed', String(index === this.levelIndex));
      const lock = button.querySelector('[data-level-lock]');
      if (lock) lock.textContent = locked ? 'LOCKED' : 'OPEN';
    });
    const best = this.best[this.level.id];
    this.updateStars(best?.stars ?? 0);
  }

  updateStars(stars) {
    if (!this.starsEl) return;
    [...this.starsEl.children].forEach((star, index) => {
      star.classList.toggle('is-filled', index < stars);
    });
  }

  nextHint() {
    const hints = this.level.hints;
    this.hintIndex = (this.hintIndex + 1) % hints.length;
    this.showHint(hints[this.hintIndex]);
  }

  showHint(text) {
    if (this.hintEl) this.hintEl.textContent = text;
  }

  spawnBurst() {
    if (REDUCED) return;
    const g = this.geometry;
    if (!g) return;
    const px = g.xToPx(this.x);
    const py = g.yToPx(this.level.loss(this.x));
    for (let i = 0; i < 26; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 90;
      this.burst.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: 0.6 + Math.random() * 1.8,
      });
    }
  }

  measure() {
    const rect = this.wrap.getBoundingClientRect();
    this.W = Math.max(1, rect.width);
    this.H = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const mobile = this.W < 560;
    const padLeft = mobile ? 38 : 54;
    const padRight = mobile ? 16 : 28;
    const padTop = mobile ? 20 : 28;
    const padBottom = mobile ? 30 : 36;
    const plotW = Math.max(1, this.W - padLeft - padRight);
    const plotH = Math.max(1, this.H - padTop - padBottom);
    const samples = [];
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i <= 240; i += 1) {
      const x = DOMAIN[0] + ((DOMAIN[1] - DOMAIN[0]) * i) / 240;
      const loss = this.level.loss(x);
      samples.push({ x, loss });
      if (loss < min) min = loss;
      if (loss > max) max = loss;
    }

    const spread = Math.max(0.0001, max - min);
    min -= spread * 0.12;
    max += spread * 0.12;

    const xToPx = (x) =>
      padLeft + ((x - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * plotW;
    const yToPx = (loss) =>
      padTop + (1 - (loss - min) / (max - min)) * plotH;

    const minima = [];
    for (let i = 1; i < samples.length - 1; i += 1) {
      const a = samples[i - 1];
      const b = samples[i];
      const c = samples[i + 1];
      if (b.loss < a.loss && b.loss < c.loss) {
        if (Math.abs(b.x - this.level.target) > this.level.tol * 2.2) {
          minima.push({ x: b.x, loss: b.loss });
        }
      }
    }

    this.geometry = {
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      min,
      max,
      samples,
      minima,
      xToPx,
      yToPx,
    };
  }

  resize() {
    if (!this.wrap) return;
    this.measure();
    this.draw();
  }

  draw() {
    const g = this.geometry;
    const ctx = this.ctx;
    if (!g || !ctx) return;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, this.W, this.H);

    this.drawGrid(g);
    this.drawTarget(g);
    this.drawCurve(g);
    this.drawMinima(g);
    this.drawStart(g);
    this.drawTrail(g);
    this.drawBall(g);
    this.drawBurst(g);
  }

  drawGrid(g) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 244, 223, 0.075)';
    ctx.fillStyle = 'rgba(113, 136, 154, 0.72)';
    ctx.lineWidth = 1;
    ctx.font = '8px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const xTicks = [-1, -0.5, 0, 0.5, 1];
    ctx.setLineDash([2, 6]);
    for (const tick of xTicks) {
      const x = g.xToPx(tick);
      ctx.beginPath();
      ctx.moveTo(x, g.padTop);
      ctx.lineTo(x, g.padTop + g.plotH);
      ctx.stroke();
      ctx.fillText(tick.toFixed(1), x, g.padTop + g.plotH + 10);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const lossTicks = 4;
    for (let i = 0; i <= lossTicks; i += 1) {
      const loss = g.min + ((g.max - g.min) * i) / lossTicks;
      const y = g.yToPx(loss);
      ctx.beginPath();
      ctx.moveTo(g.padLeft, y);
      ctx.lineTo(g.padLeft + g.plotW, y);
      ctx.stroke();
      ctx.fillText(loss.toFixed(2), g.padLeft - 8, y);
    }

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(100, 244, 223, 0.18)';
    ctx.beginPath();
    ctx.moveTo(g.padLeft, g.padTop);
    ctx.lineTo(g.padLeft, g.padTop + g.plotH);
    ctx.lineTo(g.padLeft + g.plotW, g.padTop + g.plotH);
    ctx.stroke();

    ctx.fillStyle = 'rgba(113, 136, 154, 0.55)';
    ctx.textAlign = 'left';
    ctx.fillText('LOSS', g.padLeft, g.padTop - 12);
    ctx.textAlign = 'right';
    ctx.fillText('θ', g.padLeft + g.plotW, g.padTop + g.plotH + 12);
    ctx.restore();
  }

  drawCurve(g) {
    const ctx = this.ctx;
    const { samples, xToPx, yToPx, padTop, plotH } = g;
    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    gradient.addColorStop(0, 'rgba(100, 244, 223, 0.14)');
    gradient.addColorStop(1, 'rgba(100, 244, 223, 0)');

    ctx.save();
    ctx.beginPath();
    samples.forEach((point, index) => {
      const x = xToPx(point.x);
      const y = yToPx(point.loss);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(xToPx(samples[samples.length - 1].x), padTop + plotH);
    ctx.lineTo(xToPx(samples[0].x), padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    samples.forEach((point, index) => {
      const x = xToPx(point.x);
      const y = yToPx(point.loss);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(100, 244, 223, 0.8)';
    ctx.lineWidth = 1.1;
    ctx.shadowColor = 'rgba(100, 244, 223, 0.65)';
    ctx.shadowBlur = 9;
    ctx.stroke();
    ctx.restore();
  }

  drawTarget(g) {
    const ctx = this.ctx;
    const target = this.level.target;
    const left = g.xToPx(target - this.level.tol);
    const right = g.xToPx(target + this.level.tol);
    const top = g.padTop;
    const bottom = g.padTop + g.plotH;
    const y = g.yToPx(this.level.loss(target));

    ctx.save();
    ctx.fillStyle = 'rgba(100, 244, 223, 0.045)';
    ctx.fillRect(left, top, right - left, g.plotH);
    ctx.strokeStyle = 'rgba(100, 244, 223, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    const pulse = 0.5 + Math.sin(performance.now() / 420) * 0.25;
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(100, 244, 223, ${0.35 + pulse * 0.25})`;
    ctx.beginPath();
    ctx.arc(g.xToPx(target), y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(100, 244, 223, 0.85)';
    ctx.beginPath();
    ctx.arc(g.xToPx(target), y, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(100, 244, 223, 0.6)';
    ctx.font = '7px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GLOBAL MIN', g.xToPx(target), top - 10);
    ctx.restore();
  }

  drawMinima(g) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 195, 107, 0.6)';
    ctx.font = '7px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    g.minima.slice(0, 2).forEach((point) => {
      const x = g.xToPx(point.x);
      const y = g.yToPx(point.loss);
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 195, 107, 0.38)';
      ctx.fillText('LOCAL MIN', x, y + 16);
      ctx.fillStyle = 'rgba(255, 195, 107, 0.6)';
    });
    ctx.restore();
  }

  drawStart(g) {
    const ctx = this.ctx;
    const x = g.xToPx(this.level.start);
    const y = g.yToPx(this.level.loss(this.level.start));
    ctx.save();
    ctx.strokeStyle = 'rgba(109, 140, 255, 0.28)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x, g.padTop);
    ctx.lineTo(x, g.padTop + g.plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(109, 140, 255, 0.6)';
    ctx.font = '7px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('x₀', x, g.padTop - 10);
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawTrail(g) {
    const ctx = this.ctx;
    if (!this.trail.length) return;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(100, 244, 223, 0.28)';
    ctx.beginPath();
    this.trail.forEach((point, index) => {
      const x = g.xToPx(point.x);
      const y = g.yToPx(this.level.loss(point.x));
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    for (let i = 0; i < this.trail.length; i += 5) {
      const point = this.trail[i];
      const x = g.xToPx(point.x);
      const y = g.yToPx(this.level.loss(point.x));
      const age = i / this.trail.length;
      ctx.fillStyle = `rgba(100, 244, 223, ${0.06 + age * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBall(g) {
    const ctx = this.ctx;
    const safeX = Number.isFinite(this.x) ? this.x : this.level.start;
    const loss = this.level.loss(safeX);
    const x = clamp(g.xToPx(safeX), g.padLeft - 20, g.padLeft + g.plotW + 20);
    const y = clamp(g.yToPx(loss), g.padTop - 20, g.padTop + g.plotH + 20);

    ctx.save();
    ctx.strokeStyle = 'rgba(100, 244, 223, 0.12)';
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(g.padLeft, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
    glow.addColorStop(0, 'rgba(100, 244, 223, 0.35)');
    glow.addColorStop(0.35, 'rgba(100, 244, 223, 0.12)');
    glow.addColorStop(1, 'rgba(100, 244, 223, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(100, 244, 223, 0.35)';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(235, 255, 252, 0.95)';
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();

    if (Math.abs(this.v) > 0.004) {
      const direction = Math.sign(this.v);
      ctx.strokeStyle = 'rgba(100, 244, 223, 0.45)';
      ctx.beginPath();
      ctx.moveTo(x + direction * 8, y);
      ctx.lineTo(x + direction * 20, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBurst(g) {
    if (!this.burst.length) return;
    const ctx = this.ctx;
    ctx.save();
    for (let i = this.burst.length - 1; i >= 0; i -= 1) {
      const particle = this.burst[i];
      particle.life -= 0.025;
      particle.x += particle.vx * 0.02;
      particle.y += particle.vy * 0.02;
      particle.vy += 0.8;
      if (particle.life <= 0) {
        this.burst.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(100, 244, 223, ${particle.life * 0.7})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (this.burst.length) requestAnimationFrame(() => this.draw());
  }
}

export function initLossValley() {
  const roots = document.querySelectorAll('[data-loss-game]');
  roots.forEach((root) => {
    root.__lossGame = new LossValley(root);
  });
}

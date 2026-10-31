import { NeuralCore } from './neural-core.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const INTRO_KEY = 'aiuwei:intro-seen';
const root = document.documentElement;
const body = document.body;
const intro = document.querySelector('[data-intro]');

if (intro) {
  const skipButton = intro.querySelector('[data-intro-skip]');
  const codeEl = intro.querySelector('[data-intro-code]');
  const cnEl = intro.querySelector('[data-intro-cn]');
  const wordEl = intro.querySelector('[data-intro-word]');
  const waveEl = intro.querySelector('[data-intro-wave]');
  const progressEl = intro.querySelector('[data-intro-progress]');
  const percentEl = intro.querySelector('[data-intro-percent]');
  const coreCanvas = intro.querySelector('[data-intro-core] canvas');
  const starsCanvas = intro.querySelector('[data-intro-stars]');
  const chrome = [
    document.querySelector('.site-header'),
    document.querySelector('main'),
    document.querySelector('.site-footer'),
  ].filter(Boolean);

  const forced = new URLSearchParams(window.location.search).has('intro');
  let seen = false;
  try {
    seen = sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    seen = false;
  }

  let cancelled = false;
  let finished = false;
  let core = null;
  let stars = null;
  let raf = 0;
  let timers = new Set();
  const SPEED = Math.max(0.25, Number(window.__AIUWEI_INTRO_SPEED__) || 1);
  const startedAt = performance.now();
  const DURATION = 6.2 / SPEED;

  function wait(ms) {
    return new Promise((resolve) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        resolve();
      }, ms / SPEED);
      timers.add(id);
    });
  }

  function clearTimers() {
    for (const id of timers) window.clearTimeout(id);
    timers = new Set();
  }

  function setInert(value) {
    chrome.forEach((element) => {
      if (value) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
    });
  }

  function setCopy(code, cn) {
    if (!codeEl || !cnEl) return;
    codeEl.classList.remove('is-visible');
    cnEl.classList.remove('is-visible');
    // Force a style read so the new line fades in instead of silently swapping.
    void codeEl.offsetWidth;
    codeEl.textContent = code;
    cnEl.textContent = cn;
    codeEl.classList.add('is-visible');
    window.setTimeout(() => cnEl.classList.add('is-visible'), 120 / SPEED);
  }

  function stopAmbient() {
    cancelled = true;
    cancelAnimationFrame(raf);
    clearTimers();
    core?.stop();
    stars?.stop();
  }

  function finish(reason = 'complete') {
    if (finished) return;
    finished = true;
    stopAmbient();
    if (progressEl) progressEl.style.width = '100%';
    if (percentEl) percentEl.textContent = '100%';

    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* Storage can be unavailable in private contexts. */
    }

    body.classList.add('intro-complete');
    body.classList.remove('intro-active');
    setInert(false);
    intro.classList.add('is-leaving');
    root.classList.remove('intro-skip');

    document.dispatchEvent(new CustomEvent('aiuwei:intro-complete', { detail: { reason } }));

    window.setTimeout(() => {
      intro.remove();
      body.classList.remove('has-intro');
      root.classList.add('intro-skip');
    }, 850);
  }

  function skipImmediately() {
    finished = true;
    stopAmbient();
    intro.remove();
    body.classList.remove('has-intro', 'intro-active');
    body.classList.add('intro-complete');
    root.classList.add('intro-skip');
    setInert(false);
    document.dispatchEvent(new CustomEvent('aiuwei:intro-complete', { detail: { reason: 'seen' } }));
  }

  function tick(now) {
    if (cancelled) return;
    const elapsed = Math.min(DURATION, (now - startedAt) / 1000);
    const logical = elapsed * SPEED;
    const progress = Math.min(1, logical / 6.2);
    const convergence = Math.min(1, Math.max(0, (logical - 0.55) / 2.65));
    const eased = 1 - (1 - convergence) ** 3;
    core?.setConvergence(eased);
    core?.setOpacity(Math.min(0.92, Math.max(0, (logical - 0.15) / 1.05)));

    if (progressEl) progressEl.style.width = `${(progress * 100).toFixed(1)}%`;
    if (percentEl) {
      percentEl.textContent = `${String(Math.round(progress * 100)).padStart(2, '0')}%`;
    }

    if (elapsed < DURATION) {
      raf = requestAnimationFrame(tick);
    }
  }

  if (!forced && (seen || REDUCED)) {
    skipImmediately();
  } else {
    root.classList.remove('intro-skip');
    body.classList.add('intro-active');
    setInert(true);
    core = new NeuralCore(coreCanvas, {
      nodeCount: 104,
      interactive: false,
      convergence: 0,
      opacity: 0,
    });
    core.start();
    stars = createIntroStars(starsCanvas);
    requestAnimationFrame(tick);

    if (skipButton) {
      window.setTimeout(() => skipButton.focus({ preventScroll: true }), 120);
      skipButton.addEventListener('click', () => finish('skip'));
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !finished) finish('skip');
    });

    if (forced) {
      const url = new URL(window.location.href);
      url.searchParams.delete('intro');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    (async () => {
      setCopy('ESTABLISHING UPLINK...', '正在接入深空观测站');
      await wait(720);
      if (cancelled) return;
      intro.classList.add('is-live');
      waveEl?.classList.add('is-live');
      setCopy('SIGNAL ACQUIRED // 信号已捕获', '正在校准深空频率');
      await wait(720);
      if (cancelled) return;
      setCopy('DECRYPTING NEURAL CORE...', '神经核心正在成形');
      wordEl?.classList.add('is-visible');
      await wait(1020);
      if (cancelled) return;
      setCopy('NEURAL CORE ONLINE', '神经核心已点亮');
      wordEl?.classList.add('is-live');
      core?.pulse(0.95);
      await wait(980);
      if (cancelled) return;
      setCopy('IDENTITY CONFIRMED // WEI_ER', '记录者身份已确认');
      await wait(720);
      if (cancelled) return;
      setCopy('WELCOME BACK, WEI_ER', '欢迎回到观测站');
      core?.pulse(1.25);
      await wait(940);
      if (!cancelled) finish();
    })();
  }

  function createIntroStars(canvas) {
    if (!canvas) return { stop() {} };
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let stars = [];
    let animation = 0;
    let active = true;
    const start = performance.now();

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(190, Math.max(60, (width * height) / 9000)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random(),
        y: Math.random(),
        z: 0.15 + Math.random() * 0.85,
        size: 0.4 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.9,
        teal: Math.random() > 0.7,
      }));
    }

    function draw(now) {
      if (!active) return;
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (const star of stars) {
        const alpha = (0.14 + star.z * 0.54) * (0.7 + Math.sin(t * star.speed + star.phase) * 0.3);
        const x = (star.x * width + t * 2.2 * star.z) % width;
        const y = (star.y * height + t * 1.1 * star.z) % height;
        ctx.beginPath();
        ctx.fillStyle = star.teal
          ? `rgba(100, 244, 223, ${alpha})`
          : `rgba(190, 226, 238, ${alpha})`;
        ctx.arc(x, y, star.size * (0.5 + star.z), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      animation = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    animation = requestAnimationFrame(draw);

    return {
      stop() {
        active = false;
        cancelAnimationFrame(animation);
        window.removeEventListener('resize', resize);
      },
    };
  }
}

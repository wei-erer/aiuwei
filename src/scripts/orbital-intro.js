const root = document.querySelector('[data-intro]');
if (root) {
  const canvas = root.querySelector('[data-intro-canvas]');
  const ctx = canvas.getContext('2d');
  const idle = root.querySelector('[data-intro-idle]');
  const startButton = root.querySelector('[data-intro-start]');
  const skipButton = root.querySelector('[data-intro-skip]');
  const soundButton = root.querySelector('[data-intro-sound]');
  const caption = root.querySelector('[data-intro-caption]');
  const progress = root.querySelector('[data-intro-progress]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = 8200;
  const seenKey = 'aiuwei:orbital-intro';

  let width = 0;
  let height = 0;
  let dpr = 1;
  let started = false;
  let finished = false;
  let raf = 0;
  let beganAt = 0;
  let lastCaption = '';
  let audio = null;
  let master = null;
  let muted = false;

  const stars = Array.from({ length: 280 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() * 1.4 + 0.25,
    depth: Math.random() * 0.8 + 0.2,
    phase: Math.random() * Math.PI * 2,
  }));

  const num = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, num(value)));
  const easeOut = (value) => 1 - Math.pow(1 - clamp(value), 3);
  const easeInOut = (value) => {
    const t = clamp(value);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  function resize() {
    const rect = root.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function planet(x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();

    const body = ctx.createRadialGradient(
      x - radius * 0.42,
      y - radius * 0.82,
      radius * 0.02,
      x,
      y,
      radius,
    );
    body.addColorStop(0, '#eafcff');
    body.addColorStop(0.05, '#c1f1ff');
    body.addColorStop(0.15, '#4aaed6');
    body.addColorStop(0.34, '#0d4564');
    body.addColorStop(0.58, '#041a2b');
    body.addColorStop(0.82, '#01060b');
    body.addColorStop(1, '#000205');
    ctx.fillStyle = body;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

    // Cloud bands, kept subtle so the planet reads as a physical object.
    ctx.globalAlpha = 0.075;
    ctx.fillStyle = '#e7fbff';
    for (let i = 0; i < 8; i += 1) {
      const yy = y - radius * 0.42 + i * radius * 0.12;
      const ww = radius * (0.68 + (i % 3) * 0.1);
      ctx.beginPath();
      ctx.ellipse(x - radius * 0.08, yy, ww, radius * 0.018, -0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Night side: the camera should never see a flat blue disc.
    const terminator = ctx.createLinearGradient(x - radius * 0.3, y - radius * 0.2, x + radius, y + radius * 0.7);
    terminator.addColorStop(0, 'rgba(0, 0, 0, 0)');
    terminator.addColorStop(0.52, 'rgba(0, 4, 10, 0.2)');
    terminator.addColorStop(1, 'rgba(0, 2, 6, 0.78)');
    ctx.fillStyle = terminator;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

    // Cold sun glint.
    const glint = ctx.createRadialGradient(
      x - radius * 0.42,
      y - radius * 0.86,
      0,
      x - radius * 0.42,
      y - radius * 0.86,
      radius * 0.3,
    );
    glint.addColorStop(0, 'rgba(238, 253, 255, 0.42)');
    glint.addColorStop(1, 'rgba(238, 253, 255, 0)');
    ctx.fillStyle = glint;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rim = ctx.createLinearGradient(x - radius, y - radius, x + radius * 0.6, y + radius * 0.2);
    rim.addColorStop(0, 'rgba(218, 250, 255, 0.12)');
    rim.addColorStop(0.38, 'rgba(214, 250, 255, 0.78)');
    rim.addColorStop(0.75, 'rgba(110, 205, 244, 0.34)');
    rim.addColorStop(1, 'rgba(90, 180, 230, 0.05)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1.4, radius * 0.003);
    ctx.shadowColor = 'rgba(140, 230, 255, 0.55)';
    ctx.shadowBlur = Math.max(12, radius * 0.025);
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.992, Math.PI * 1.02, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(167, 234, 255, 0.62)';
    ctx.lineWidth = Math.max(1, radius * 0.0016);
    ctx.shadowColor = 'rgba(110, 210, 255, 0.6)';
    ctx.shadowBlur = Math.max(8, radius * 0.04);
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.992, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function station(x, y, scale, alpha, time) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.19);
    ctx.globalAlpha = alpha;
    ctx.scale(scale, scale);

    const rx = width * 0.2;
    const ry = rx * 0.27;
    const metal = ctx.createLinearGradient(-rx, -ry, rx, ry);
    metal.addColorStop(0, 'rgba(237, 250, 255, 0.92)');
    metal.addColorStop(0.36, 'rgba(114, 160, 184, 0.55)');
    metal.addColorStop(0.7, 'rgba(40, 74, 94, 0.28)');
    metal.addColorStop(1, 'rgba(220, 246, 255, 0.7)');

    for (let i = 0; i < 3; i += 1) {
      const rr = 1 + i * 0.17;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * rr, ry * rr, 0, 0, Math.PI * 2);
      ctx.strokeStyle = i === 0 ? metal : 'rgba(148, 210, 236, 0.28)';
      ctx.lineWidth = i === 0 ? 1.5 : 1;
      ctx.setLineDash(i === 1 ? [2, 9] : []);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Structural spines.
    for (let i = 0; i < 4; i += 1) {
      const angle = (Math.PI / 2) * i + 0.28;
      const px = Math.cos(angle) * rx;
      const py = Math.sin(angle) * ry;
      ctx.beginPath();
      ctx.moveTo(px * 0.72, py * 0.72);
      ctx.lineTo(px * 1.1, py * 1.1);
      ctx.strokeStyle = 'rgba(210, 246, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Central hub.
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(7, width * 0.009), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4, 17, 28, 0.94)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 249, 255, 0.9)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, width * 0.0028), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(123, 220, 255, 0.95)';
    ctx.shadowColor = 'rgba(123, 220, 255, 0.95)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Docking lights.
    for (let i = 0; i < 7; i += 1) {
      const a = -0.5 + i * 0.22;
      const lx = Math.cos(a) * rx * 0.98;
      const ly = Math.sin(a) * ry * 0.98;
      const blink = 0.35 + 0.65 * Math.max(0, Math.sin(time * 5 + i * 0.9));
      ctx.globalAlpha = alpha * blink;
      ctx.beginPath();
      ctx.arc(lx, ly, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? '#bff4ff' : '#76cfff';
      ctx.shadowColor = '#8be4ff';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  function drawIdleFrame(time = 0) {
    const cx = width * 0.7;
    const cy = height * 0.68;
    const radius = Math.min(width, height) * 0.18;
    planet(cx, cy, radius);
    station(width * 0.56, height * 0.48, Math.min(width, height) / 700, 0.34, time);
  }

  function drawFrame(t, time) {
    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createRadialGradient(width * 0.58, height * 0.38, 0, width * 0.58, height * 0.38, Math.max(width, height) * 0.85);
    bg.addColorStop(0, '#071a2a');
    bg.addColorStop(0.42, '#030c16');
    bg.addColorStop(1, '#010307');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const approach = easeInOut(clamp(t / 0.9));
    const warp = clamp((t - 0.02) / 0.25) * (1 - clamp((t - 0.46) / 0.38));
    const shake = (1 - clamp(t / 0.74)) * (0.5 + warp * 3.2);
    const centerX = width * 0.56;
    const centerY = height * 0.44;

    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // Stars. During the jump they stretch away from the direction of travel.
    for (const star of stars) {
      const sx = star.x * width;
      const sy = star.y * height;
      const twinkle = 0.55 + 0.45 * Math.sin(time * 0.0016 + star.phase);
      const alpha = (0.18 + star.depth * 0.72) * twinkle;
      if (warp > 0.02) {
        const dx = sx - centerX;
        const dy = sy - centerY;
        const pull = warp * (0.08 + star.depth * 0.22);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dx * pull, sy + dy * pull);
        ctx.strokeStyle = `rgba(190, 235, 255, ${alpha * (0.25 + warp * 0.75)})`;
        ctx.lineWidth = star.size * (0.7 + warp);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.fillStyle = `rgba(205, 235, 250, ${alpha})`;
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Planet becomes a dark limb at the bottom, not a full-screen blue wash.
    const radius = Math.min(width, height) * (0.16 + Math.pow(approach, 1.6) * 1.2);
    const px = width * (0.7 + approach * 0.02);
    const py = height * (0.57 + approach * 1.1);
    planet(px, py, radius);

    // Station approach.
    const stationAlpha = clamp((t - 0.08) / 0.32) * (1 - clamp((t - 0.8) / 0.2));
    station(
      width * (0.58 - approach * 0.02),
      height * (0.42 + approach * 0.04),
      (Math.min(width, height) / 700) * (0.55 + approach * 0.9),
      stationAlpha,
      time,
    );

    // Lens streak from the cold sun.
    const flare = ctx.createLinearGradient(0, height * 0.24, width, height * 0.24);
    flare.addColorStop(0, 'rgba(145, 225, 255, 0)');
    flare.addColorStop(0.36, 'rgba(190, 242, 255, 0.2)');
    flare.addColorStop(0.58, 'rgba(235, 252, 255, 0.08)');
    flare.addColorStop(1, 'rgba(145, 225, 255, 0)');
    ctx.fillStyle = flare;
    ctx.fillRect(0, height * 0.235, width, 1.2);

    // The docking iris opens around the camera.
    const iris = clamp((t - 0.62) / 0.3);
    if (iris > 0) {
      const hole = easeInOut(iris) * Math.hypot(width, height) * 0.92;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 2, 7, 0.97)';
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.arc(width * 0.5, height * 0.5, hole, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(158, 226, 255, ${0.6 - iris * 0.4})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(123, 220, 255, 0.8)';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.5, Math.max(0, hole), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Docking iris: a physical metal ring, not a flat circular mask.
      if (hole < Math.hypot(width, height) * 0.64) {
        ctx.save();
        ctx.translate(width * 0.5, height * 0.5);
        ctx.rotate(iris * 0.22);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(176, 234, 255, ${0.42 - iris * 0.18})`;
        ctx.lineWidth = 5;
        ctx.shadowColor = 'rgba(110, 210, 250, 0.5)';
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(4, hole + 12), 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(218, 248, 255, ${0.72 - iris * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(4, hole + 4), 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 16; i += 1) {
          const angle = (Math.PI * 2 * i) / 16;
          const inner = hole + 9;
          const outer = hole + (i % 4 === 0 ? 30 : 18);
          ctx.strokeStyle = `rgba(174, 234, 255, ${0.18 + (i % 4 === 0 ? 0.2 : 0)})`;
          ctx.lineWidth = i % 4 === 0 ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Final flash and fade into the live page.
    const flash = clamp((t - 0.84) / 0.12);
    if (flash > 0) {
      ctx.fillStyle = `rgba(235, 250, 255, ${flash * 0.82})`;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();

    // Keep a cold vignette over everything so text stays readable.
    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, Math.min(width, height) * 0.1, width * 0.5, height * 0.48, Math.max(width, height) * 0.72);
    vignette.addColorStop(0, 'rgba(0, 3, 8, 0)');
    vignette.addColorStop(0.72, 'rgba(0, 3, 8, 0.28)');
    vignette.addColorStop(1, 'rgba(0, 2, 6, 0.74)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  function drawIdle() {
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createRadialGradient(width * 0.62, height * 0.38, 0, width * 0.62, height * 0.38, Math.max(width, height) * 0.8);
    bg.addColorStop(0, '#061827');
    bg.addColorStop(0.44, '#030b15');
    bg.addColorStop(1, '#010307');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
      const alpha = 0.2 + star.depth * 0.55;
      ctx.beginPath();
      ctx.fillStyle = `rgba(205, 235, 250, ${alpha})`;
      ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant cold sun.
    const sun = ctx.createRadialGradient(width * 0.18, height * 0.16, 0, width * 0.18, height * 0.16, Math.min(width, height) * 0.2);
    sun.addColorStop(0, 'rgba(205, 246, 255, 0.2)');
    sun.addColorStop(0.4, 'rgba(100, 190, 230, 0.06)');
    sun.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);

    drawIdleFrame(0);
  }

  function setCaption(value) {
    if (!caption || value === lastCaption) return;
    lastCaption = value;
    if (!value) {
      caption.classList.remove('is-visible');
      return;
    }
    caption.textContent = value;
    caption.classList.add('is-visible');
  }

  function updateProgress(value) {
    if (!progress) return;
    progress.style.width = `${clamp(value) * 100}%`;
  }

  function ensureAudio() {
    if (audio) return audio;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      audio = new AudioCtor();
      master = audio.createGain();
      master.gain.value = 0;
      master.connect(audio.destination);
      return audio;
    } catch (_) {
      audio = null;
      return null;
    }
  }

  function tone(frequency, when, length, gainValue, type = 'sine') {
    if (!audio || !master || muted) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(gainValue, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + length + 0.05);
  }

  function startAudio() {
    const context = ensureAudio();
    if (!context) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
    const now = context.currentTime + 0.03;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(muted ? 0 : 0.0001, now);
    master.gain.exponentialRampToValueAtTime(muted ? 0.0001 : 0.22, now + 0.8);

    // Sub drone.
    const drone = context.createOscillator();
    const droneGain = context.createGain();
    const droneFilter = context.createBiquadFilter();
    drone.type = 'sine';
    drone.frequency.value = 42;
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 180;
    droneGain.gain.value = 0.045;
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(master);
    drone.start(now);

    const harmonic = context.createOscillator();
    const harmonicGain = context.createGain();
    harmonic.type = 'triangle';
    harmonic.frequency.value = 84;
    harmonicGain.gain.value = 0.016;
    harmonic.connect(harmonicGain);
    harmonicGain.connect(master);
    harmonic.start(now);

    // Warp noise.
    const length = Math.floor(context.sampleRate * 1.8);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = buffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(380, now + 0.1);
    noiseFilter.frequency.exponentialRampToValueAtTime(2200, now + 1.2);
    noiseFilter.Q.value = 0.7;
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.11, now + 0.45);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    noise.stop(now + 1.9);

    // Docking sequence.
    const beeps = [2.2, 2.65, 3.1, 3.55, 4.0, 4.45, 5.2, 5.7];
    beeps.forEach((time, index) => {
      tone(index % 2 === 0 ? 880 : 1320, now + time, 0.16, 0.035, 'sine');
      tone(55, now + time, 0.1, 0.012, 'triangle');
    });

    // Impact as the window opens.
    const impact = context.createOscillator();
    const impactGain = context.createGain();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(52, now + 5.9);
    impact.frequency.exponentialRampToValueAtTime(30, now + 7.2);
    impactGain.gain.setValueAtTime(0.0001, now + 5.9);
    impactGain.gain.exponentialRampToValueAtTime(0.2, now + 6.02);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 7.3);
    impact.connect(impactGain);
    impactGain.connect(master);
    impact.start(now + 5.9);
    impact.stop(now + 7.4);

    const rumble = context.createBufferSource();
    const rumbleBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 1.4), context.sampleRate);
    const rumbleData = rumbleBuffer.getChannelData(0);
    for (let i = 0; i < rumbleData.length; i += 1) rumbleData[i] = Math.random() * 2 - 1;
    const rumbleGain = context.createGain();
    const rumbleFilter = context.createBiquadFilter();
    rumble.buffer = rumbleBuffer;
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 220;
    rumbleGain.gain.setValueAtTime(0.0001, now + 5.95);
    rumbleGain.gain.exponentialRampToValueAtTime(0.12, now + 6.08);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 7.2);
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(master);
    rumble.start(now + 5.95);
    rumble.stop(now + 7.3);
  }

  function stopAudio() {
    if (!audio || !master) return;
    try {
      const now = audio.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0.0001, now, 0.15);
      window.setTimeout(() => {
        audio?.close().catch(() => {});
        audio = null;
        master = null;
      }, 800);
    } catch (_) {
      /* Audio is optional. */
    }
  }

  function toggleSound() {
    muted = !muted;
    if (soundButton) {
      soundButton.textContent = muted ? '声音：关' : '声音：开';
      soundButton.setAttribute('aria-pressed', String(!muted));
    }
    if (master && audio) {
      const now = audio.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(muted ? 0.0001 : 0.22, now, 0.08);
    }
  }

  function finish({ instant = false } = {}) {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    try {
      sessionStorage.setItem(seenKey, '1');
    } catch (_) {
      /* Ignore storage failures. */
    }
    document.documentElement.classList.remove('intro-skip');
    document.documentElement.classList.remove('has-intro');
    document.body.classList.remove('intro-open');
    document.body.classList.add('intro-complete');
    setCaption('');
    updateProgress(1);

    if (instant) {
      root.classList.add('is-done');
      root.setAttribute('aria-hidden', 'true');
      stopAudio();
      return;
    }

    root.classList.add('is-leaving');
    window.setTimeout(() => {
      root.classList.add('is-done');
      root.setAttribute('aria-hidden', 'true');
    }, 720);
    stopAudio();
  }

  function frame(now) {
    if (!started || finished) return;
    const elapsed = now - beganAt;
    const t = clamp(elapsed / duration);
    drawFrame(t, elapsed);
    updateProgress(t);

    if (t < 0.18) setCaption('深空信号锁定');
    else if (t < 0.44) setCaption('接近轨道站 / DECK 07');
    else if (t < 0.64) setCaption('对接口开启');
    else if (t < 0.86) setCaption('进入观测舱');
    else setCaption('欢迎回来，wei_er');

    if (t >= 1) {
      finish();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function begin() {
    if (started || finished) return;
    started = true;
    beganAt = performance.now();
    root.classList.add('is-started');
    idle?.setAttribute('aria-hidden', 'true');
    document.body.classList.add('intro-open');
    startAudio();
    raf = requestAnimationFrame(frame);
  }

  function skip() {
    if (finished) return;
    started = true;
    finish({ instant: true });
  }

  // Seen this session: remove the overlay before first paint.
  if (document.documentElement.classList.contains('intro-skip') || reduced) {
    document.body.classList.remove('intro-open');
    document.body.classList.add('intro-complete');
    root.classList.add('is-done');
    root.setAttribute('aria-hidden', 'true');
    return;
  }

  resize();
  drawIdle();
  window.addEventListener('resize', () => {
    if (finished) return;
    resize();
    if (!started) drawIdle();
  }, { passive: true });

  startButton?.addEventListener('click', begin);
  skipButton?.addEventListener('click', skip);
  soundButton?.addEventListener('click', toggleSound);

  document.addEventListener('keydown', (event) => {
    if (finished) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      skip();
    }
    if (!started && (event.key === 'Enter' || event.key === ' ')) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('button')) return;
      event.preventDefault();
      begin();
    }
  });

  document.body.classList.add('intro-open');
  startButton?.focus({ preventScroll: true });
}

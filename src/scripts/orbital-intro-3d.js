import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const root = document.querySelector('[data-intro]');
if (root) {
  const canvas = root.querySelector('[data-intro-canvas]');
  const idle = root.querySelector('[data-intro-idle]');
  const startButton = root.querySelector('[data-intro-start]');
  const skipButton = root.querySelector('[data-intro-skip]');
  const soundButton = root.querySelector('[data-intro-sound]');
  const caption = root.querySelector('[data-intro-caption]');
  const progress = root.querySelector('[data-intro-progress]');
  const flash = root.querySelector('[data-intro-flash]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = 8600;
  const seenKey = 'aiuwei:orbital-intro';

  let started = false;
  let finished = false;
  let raf = 0;
  let beganAt = 0;
  let lastCaption = '';
  let audio = null;
  let master = null;
  let muted = false;
  let renderer = null;
  let composer = null;
  let scene = null;
  let camera = null;
  let planet = null;
  let station = null;
  let gate = null;
  let stars = null;
  let flashValue = 0;
  let width = 1;
  let height = 1;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
  const easeInOut = (value) => {
    const t = clamp(value);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  function makePlanetTexture() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const g = c.getContext('2d');
    const base = g.createLinearGradient(0, 0, 0, 512);
    base.addColorStop(0, '#082b45');
    base.addColorStop(0.32, '#125f87');
    base.addColorStop(0.55, '#0a3857');
    base.addColorStop(0.78, '#041523');
    base.addColorStop(1, '#01050a');
    g.fillStyle = base;
    g.fillRect(0, 0, 1024, 512);

    // Horizontal gas bands.
    for (let i = 0; i < 34; i += 1) {
      const y = (i / 34) * 512 + Math.sin(i * 2.1) * 7;
      const h = 4 + (i % 5) * 6;
      const alpha = 0.035 + (i % 4) * 0.012;
      g.fillStyle = i % 3 === 0 ? `rgba(190,240,255,${alpha})` : `rgba(2,18,32,${alpha + 0.025})`;
      g.beginPath();
      g.ellipse(512, y, 620, h, 0, 0, Math.PI * 2);
      g.fill();
    }

    // Storm spots.
    const storm = g.createRadialGradient(630, 255, 2, 630, 255, 75);
    storm.addColorStop(0, 'rgba(225,250,255,.28)');
    storm.addColorStop(0.35, 'rgba(75,160,195,.18)');
    storm.addColorStop(0.72, 'rgba(4,25,40,.22)');
    storm.addColorStop(1, 'rgba(4,25,40,0)');
    g.fillStyle = storm;
    g.beginPath();
    g.ellipse(630, 255, 76, 26, -0.12, 0, Math.PI * 2);
    g.fill();

    // Fine noise.
    for (let i = 0; i < 1800; i += 1) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      g.fillStyle = `rgba(210,245,255,${Math.random() * 0.045})`;
      g.fillRect(x, y, 1 + Math.random() * 2, 1);
    }

    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  function makeGlowTexture(colors) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    colors.forEach(([stop, color]) => grad.addColorStop(stop, color));
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makeStation() {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({
      color: 0xaac7d5,
      metalness: 0.9,
      roughness: 0.28,
      emissive: 0x07151e,
      emissiveIntensity: 0.6,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x203945,
      metalness: 0.85,
      roughness: 0.4,
      emissive: 0x020b12,
      emissiveIntensity: 0.4,
    });
    const glow = new THREE.MeshBasicMaterial({ color: 0x9feaff, transparent: true, opacity: 0.9 });
    const glowSoft = new THREE.MeshBasicMaterial({ color: 0x5ac8ff, transparent: true, opacity: 0.5 });

    const ringGroup = new THREE.Group();
    ringGroup.rotation.x = 1.12;
    ringGroup.rotation.y = -0.22;
    ringGroup.rotation.z = 0.18;

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.055, 10, 220), metal);
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.032, 8, 180), dark);
    const ghostRing = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.018, 8, 220), glowSoft);
    ringGroup.add(outerRing, innerRing, ghostRing);

    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      const x = Math.cos(angle) * 3.4;
      const y = Math.sin(angle) * 3.4;
      const module = new THREE.Mesh(
        new THREE.BoxGeometry(i % 4 === 0 ? 0.36 : 0.22, 0.1, 0.52),
        i % 5 === 0 ? dark : metal,
      );
      module.position.set(x, y, 0);
      module.rotation.z = angle;
      ringGroup.add(module);

      if (i % 4 === 0) {
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), glow);
        light.position.set(x * 1.03, y * 1.03, 0.02);
        ringGroup.add(light);
      }
    }

    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.4, 5), dark);
      spoke.position.set(cos * 1.7, sin * 1.7, 0);
      spoke.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(cos, sin, 0));
      ringGroup.add(spoke);
    }

    // Solar panels.
    for (const angle of [0.7, 2.3, 3.9, 5.5]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.018, 0.42),
        new THREE.MeshStandardMaterial({ color: 0x0b2c47, metalness: 0.6, roughness: 0.3, emissive: 0x04111b, emissiveIntensity: 0.4 }),
      );
      panel.position.set(Math.cos(angle) * 3.05, Math.sin(angle) * 3.05, 0.35);
      panel.rotation.z = angle;
      ringGroup.add(panel);
    }

    group.add(ringGroup);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.66, 1.2, 24), metal);
    hub.rotation.x = Math.PI / 2;
    const hubCore = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 20), new THREE.MeshBasicMaterial({ color: 0xc9f8ff }));
    const hubGlow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 24), new THREE.MeshBasicMaterial({ color: 0x5ac8ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(hub, hubCore, hubGlow);

    const stationLight = new THREE.PointLight(0x7bdcff, 3, 12, 2);
    stationLight.position.set(0, 0, 1.5);
    group.add(stationLight);

    group.position.set(5.8, 2.8, -12);
    group.scale.setScalar(1.25);
    group.rotation.set(0.1, -0.2, 0.04);
    return group;
  }

  function makeGate() {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x9fbdcb, metalness: 0.9, roughness: 0.25, emissive: 0x05131c, emissiveIntensity: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.065, 10, 180), metal);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(1.58, 0.022, 8, 180), new THREE.MeshBasicMaterial({ color: 0x8ee9ff }));
    group.add(ring, inner);
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.32), metal);
      arm.position.set(Math.cos(a) * 1.82, Math.sin(a) * 1.82, 0);
      arm.rotation.z = a;
      group.add(arm);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0xbdf6ff }));
      light.position.set(Math.cos(a) * 2.02, Math.sin(a) * 2.02, 0.05);
      group.add(light);
    }
    group.position.set(1.2, 0.3, -5.5);
    group.scale.setScalar(0.82);
    return group;
  }

  function setup() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x02050a, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02050a, 0.008);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
    camera.position.set(0, 0.55, 13);
    camera.lookAt(0.4, 0.3, -3);

    scene.add(new THREE.AmbientLight(0x233a4b, 0.9));
    const sunLight = new THREE.DirectionalLight(0xdff6ff, 3.2);
    sunLight.position.set(-8, 12, 9);
    scene.add(sunLight);
    const rimLight = new THREE.DirectionalLight(0x2f6bff, 1.4);
    rimLight.position.set(10, -4, -7);
    scene.add(rimLight);

    // Stars.
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i += 1) {
      const radius = 35 + Math.random() * 55;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xcdefff, size: 0.085, transparent: true, opacity: 0.82, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    scene.add(stars);

    // Nebula glow and sun.
    const nebula = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture([[0, 'rgba(36,100,145,.3)'], [0.4, 'rgba(15,45,75,.18)'], [1, 'rgba(0,0,0,0)']]),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    nebula.position.set(13, 6, -34);
    nebula.scale.set(38, 38, 1);
    scene.add(nebula);

    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture([[0, 'rgba(225,250,255,.9)'], [0.18, 'rgba(145,225,255,.45)'], [0.55, 'rgba(50,130,190,.08)'], [1, 'rgba(0,0,0,0)']]),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sun.position.set(-18, 13, -28);
    sun.scale.set(22, 22, 1);
    scene.add(sun);

    // Planet.
    const planetGroup = new THREE.Group();
    planet = new THREE.Mesh(
      new THREE.SphereGeometry(12, 64, 64),
      new THREE.MeshStandardMaterial({
        map: makePlanetTexture(),
        roughness: 0.98,
        metalness: 0,
        emissive: 0x020d17,
        emissiveIntensity: 0.14,
      }),
    );
    planet.rotation.y = -0.9;
    planet.rotation.z = 0.12;
    planetGroup.add(planet);
    planetGroup.position.set(7.2, -8.2, -24);
    scene.add(planetGroup);
    planet = planetGroup;

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture([[0, 'rgba(105,220,255,.2)'], [0.35, 'rgba(35,135,190,.12)'], [1, 'rgba(0,0,0,0)']]),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.position.set(7.2, -8.2, -24.6);
    halo.scale.set(34, 34, 1);
    scene.add(halo);

    station = makeStation();
    scene.add(station);
    gate = makeGate();
    gate.visible = false;
    scene.add(gate);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.72, 0.82);
    bloom.threshold = 0.8;
    bloom.strength = 0.42;
    bloom.radius = 0.72;
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    resize();
  }

  function resize() {
    if (!renderer || !camera) return;
    const rect = root.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
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
    if (progress) progress.style.width = `${clamp(value) * 100}%`;
  }

  function setFlash(value) {
    flashValue = clamp(value);
    if (flash) flash.style.opacity = String(flashValue);
  }

  function renderIdle(now) {
    if (!renderer || finished) return;
    const t = now * 0.00008;
    camera.position.set(Math.sin(t) * 0.18, 0.55 + Math.sin(t * 1.4) * 0.06, 13);
    camera.lookAt(0.5, 0.3, -3);
    station.rotation.z = 0.04 + Math.sin(t * 0.9) * 0.02;
    station.rotation.y = -0.2 + Math.sin(t * 0.6) * 0.02;
    gate.rotation.z = Math.sin(t * 0.5) * 0.05;
    stars.rotation.z = t * 0.03;
    composer.render();
    raf = requestAnimationFrame(renderIdle);
  }

  function renderFlight(now) {
    if (finished) return;
    const elapsed = now - beganAt;
    const t = clamp(elapsed / duration);
    const ease = easeInOut(t);
    const shake = (1 - clamp(t / 0.7)) * (0.015 + Math.sin(t * 33) * 0.008);
    const z = 13 - 21 * ease;
    camera.position.set(Math.sin(t * Math.PI * 1.4) * 0.45, 0.55 + Math.sin(t * Math.PI) * 0.2 + shake, z);
    camera.lookAt(0.5, 0.2, -5.5 - ease * 2);
    camera.rotation.z = Math.sin(t * Math.PI * 3) * 0.012 * (1 - t);
    camera.fov = 50 + Math.sin(t * Math.PI) * 14;
    camera.updateProjectionMatrix();

    station.rotation.z = 0.04 + t * 0.6;
    station.rotation.y = -0.2 + Math.sin(t * Math.PI * 1.2) * 0.2;
    gate.rotation.z = -t * 0.5;
    planet.rotation.y = -0.9 + t * 0.18;
    stars.rotation.z = t * 0.1;

    const flashIn = clamp((t - 0.86) / 0.1);
    setFlash(flashIn * 0.95);
    updateProgress(t);

    if (t < 0.18) setCaption('深空信号锁定');
    else if (t < 0.42) setCaption('第一人称接近 / DECK 07');
    else if (t < 0.62) setCaption('对接口开启');
    else if (t < 0.82) setCaption('进入观测舱');
    else setCaption('欢迎回来，wei_er');

    composer.render();

    if (t >= 1) {
      finish();
      return;
    }
    raf = requestAnimationFrame(renderFlight);
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
    master.gain.setValueAtTime(muted ? 0.0001 : 0.0001, now);
    master.gain.exponentialRampToValueAtTime(muted ? 0.0001 : 0.2, now + 0.7);

    const drone = context.createOscillator();
    const droneGain = context.createGain();
    const droneFilter = context.createBiquadFilter();
    drone.type = 'sine';
    drone.frequency.value = 38;
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 150;
    droneGain.gain.value = 0.055;
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(master);
    drone.start(now);

    const harmonic = context.createOscillator();
    const harmonicGain = context.createGain();
    harmonic.type = 'triangle';
    harmonic.frequency.value = 76;
    harmonicGain.gain.value = 0.016;
    harmonic.connect(harmonicGain);
    harmonicGain.connect(master);
    harmonic.start(now);

    const noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 1.8), context.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = noiseBuffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(300, now + 0.05);
    noiseFilter.frequency.exponentialRampToValueAtTime(2600, now + 1.15);
    noiseFilter.Q.value = 0.8;
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.13, now + 0.35);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.65);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    noise.stop(now + 1.75);

    [1.9, 2.35, 2.8, 3.25, 3.7, 4.15, 4.6, 5.1].forEach((time, index) => {
      tone(index % 2 === 0 ? 880 : 1320, now + time, 0.16, 0.035, 'sine');
      tone(55, now + time, 0.1, 0.012, 'triangle');
    });

    const impact = context.createOscillator();
    const impactGain = context.createGain();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(54, now + 6.1);
    impact.frequency.exponentialRampToValueAtTime(28, now + 7.4);
    impactGain.gain.setValueAtTime(0.0001, now + 6.1);
    impactGain.gain.exponentialRampToValueAtTime(0.23, now + 6.2);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 7.5);
    impact.connect(impactGain);
    impactGain.connect(master);
    impact.start(now + 6.1);
    impact.stop(now + 7.6);

    const rumbleBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 1.4), context.sampleRate);
    const rumbleData = rumbleBuffer.getChannelData(0);
    for (let i = 0; i < rumbleData.length; i += 1) rumbleData[i] = Math.random() * 2 - 1;
    const rumble = context.createBufferSource();
    const rumbleFilter = context.createBiquadFilter();
    const rumbleGain = context.createGain();
    rumble.buffer = rumbleBuffer;
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 200;
    rumbleGain.gain.setValueAtTime(0.0001, now + 6.15);
    rumbleGain.gain.exponentialRampToValueAtTime(0.13, now + 6.25);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 7.4);
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(master);
    rumble.start(now + 6.15);
    rumble.stop(now + 7.45);
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
      master.gain.setTargetAtTime(muted ? 0.0001 : 0.2, now, 0.08);
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
    setFlash(0);
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

  function begin() {
    if (started || finished) return;
    started = true;
    beganAt = performance.now();
    root.classList.add('is-started');
    idle?.setAttribute('aria-hidden', 'true');
    document.body.classList.add('intro-open');
    if (gate) gate.visible = true;
    startAudio();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(renderFlight);
  }

  function skip() {
    if (finished) return;
    started = true;
    finish({ instant: true });
  }

  if (document.documentElement.classList.contains('intro-skip') || reduced) {
    document.body.classList.remove('intro-open');
    document.body.classList.add('intro-complete');
    root.classList.add('is-done');
    root.setAttribute('aria-hidden', 'true');
    return;
  }

  try {
    setup();
  } catch (error) {
    console.warn('Orbital intro WebGL unavailable:', error);
    root.classList.add('orbital-intro--fallback');
    startButton?.addEventListener('click', () => finish({ instant: true }));
    skipButton?.addEventListener('click', () => finish({ instant: true }));
    document.body.classList.add('intro-open');
    return;
  }

  window.addEventListener('resize', () => {
    if (finished) return;
    resize();
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

  drawIdle();
  startButton?.focus({ preventScroll: true });

  function drawIdle() {
    if (finished) return;
    renderIdle(performance.now());
  }
}

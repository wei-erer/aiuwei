import { href, site } from '../data/site';

const root = document.querySelector('[data-console]');
if (root) {
  const panel = root.querySelector('.observatory-console__panel');
  const log = root.querySelector('[data-console-log]');
  const form = root.querySelector('[data-console-form]');
  const input = root.querySelector('[data-console-input]');
  const openButtons = document.querySelectorAll('[data-console-open]');
  const closeButtons = root.querySelectorAll('[data-console-close]');
  let lastFocus = null;
  let history = [];
  let historyIndex = 0;
  let audio = null;
  let ambient = null;
  let ambientOn = false;

  function addLine(text, type = '') {
    if (!log) return;
    const p = document.createElement('p');
    p.className = `console-line${type ? ` console-line--${type}` : ''}`;
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function isIntroOpen() {
    return document.body.classList.contains('intro-open');
  }

  function open() {
    if (isIntroOpen()) return;
    lastFocus = document.activeElement;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('console-open');
    window.setTimeout(() => input?.focus({ preventScroll: true }), 40);
  }

  function close({ restore = true } = {}) {
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('console-open');
    if (restore && lastFocus instanceof HTMLElement) {
      lastFocus.focus({ preventScroll: true });
    }
  }

  function go(path) {
    close({ restore: false });
    window.location.assign(href(path));
  }

  function startAmbient() {
    if (ambientOn) {
      addLine('AMBIENT / 已经在播放', 'ok');
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      addLine('AUDIO / 这台设备不支持音频', 'error');
      return;
    }
    try {
      if (!audio) audio = new AudioCtor();
      audio.resume().catch(() => {});
      ambient = audio.createGain();
      ambient.gain.value = 0.0001;
      ambient.connect(audio.destination);

      const low = audio.createOscillator();
      const lowGain = audio.createGain();
      const filter = audio.createBiquadFilter();
      low.type = 'sine';
      low.frequency.value = 42;
      lowGain.gain.value = 0.03;
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      low.connect(filter);
      filter.connect(lowGain);
      lowGain.connect(ambient);
      low.start();

      const high = audio.createOscillator();
      const highGain = audio.createGain();
      high.type = 'triangle';
      high.frequency.value = 84;
      highGain.gain.value = 0.008;
      high.connect(highGain);
      highGain.connect(ambient);
      high.start();

      ambient.gain.exponentialRampToValueAtTime(0.04, audio.currentTime + 0.8);
      ambientOn = true;
      addLine('AMBIENT / ON · 深空低频已接入，输入 sound off 关闭', 'ok');
    } catch (_) {
      addLine('AUDIO / 启动失败', 'error');
    }
  }

  function stopAmbient() {
    if (!ambientOn || !audio || !ambient) {
      addLine('AMBIENT / 当前是关闭状态', 'dim');
      return;
    }
    try {
      ambient.gain.cancelScheduledValues(audio.currentTime);
      ambient.gain.setTargetAtTime(0.0001, audio.currentTime, 0.15);
      window.setTimeout(() => {
        audio?.close().catch(() => {});
        audio = null;
        ambient = null;
        ambientOn = false;
      }, 700);
      addLine('AMBIENT / OFF', 'ok');
    } catch (_) {
      ambientOn = false;
    }
  }

  function help() {
    addLine('available commands:', 'dim');
    addLine('  home | projects | writing | about', 'dim');
    addLine('  intro            重播 3D 开场', 'dim');
    addLine('  github | rss     打开外部信号', 'dim');
    addLine('  copy             复制当前页面链接', 'dim');
    addLine('  sound on|off     环境低频', 'dim');
    addLine('  whoami | ping    查看身份 / 连接状态', 'dim');
    addLine('  clear | close    清屏 / 关闭终端', 'dim');
  }

  async function copyLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      addLine(`COPIED / ${url}`, 'ok');
    } catch (_) {
      try {
        const temp = document.createElement('textarea');
        temp.value = url;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
        addLine(`COPIED / ${url}`, 'ok');
      } catch {
        addLine('COPY / 复制失败，请手动复制地址栏', 'error');
      }
    }
  }

  function run(raw) {
    const value = raw.trim();
    if (!value) return;
    addLine(`wei_er@aiuwei:~$ ${value}`, 'cmd');
    history.push(value);
    historyIndex = history.length;
    const [command, ...args] = value.toLowerCase().split(/\s+/);
    switch (command) {
      case 'help':
        help();
        break;
      case 'home':
        go('');
        break;
      case 'projects':
        go('projects/');
        break;
      case 'writing':
        go('writing/');
        break;
      case 'about':
        go('about/');
        break;
      case 'intro':
        close({ restore: false });
        window.location.assign(`${href('')}?intro=1`);
        break;
      case 'github':
        window.open(site.github, '_blank', 'noopener');
        addLine('EXTERNAL / GitHub', 'dim');
        break;
      case 'rss':
        window.open(href('rss.xml'), '_blank', 'noopener');
        addLine('EXTERNAL / RSS', 'dim');
        break;
      case 'copy':
        copyLink();
        break;
      case 'sound':
        if (args[0] === 'on') startAmbient();
        else if (args[0] === 'off') stopAmbient();
        else addLine('SOUND / 用法：sound on 或 sound off', 'dim');
        break;
      case 'whoami':
        addLine('wei_er / observer / AIUWEI / deck 07', 'ok');
        break;
      case 'ping':
        addLine('pong · orbital relay 07 · latency 24ms', 'ok');
        break;
      case 'clear':
        if (log) log.replaceChildren();
        break;
      case 'close':
      case 'exit':
        close();
        break;
      default:
        addLine(`command not found: ${command} · 输入 help`, 'error');
    }
  }

  openButtons.forEach((button) => button.addEventListener('click', open));
  closeButtons.forEach((button) => button.addEventListener('click', () => close()));

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input) return;
    run(input.value);
    input.value = '';
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] ?? '';
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] ?? '';
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (root.classList.contains('is-open')) close();
      else open();
      return;
    }
    if (event.key === 'Escape' && root.classList.contains('is-open')) {
      close();
    }
  });

  panel?.addEventListener('click', (event) => event.stopPropagation());
  root.addEventListener('click', () => close());

  if (new URLSearchParams(window.location.search).has('console')) {
    window.setTimeout(open, 120);
  }
}

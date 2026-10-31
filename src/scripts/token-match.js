const PAIRS = [
  { a: '过拟合', b: '正则化', note: '正则化用来抑制过拟合。' },
  { a: 'GPU', b: '显存', note: '训练时最先被卡住的往往是显存。' },
  { a: 'RAG', b: '检索', note: 'RAG 先检索外部知识，再交给模型生成。' },
  { a: 'Agent', b: '工具调用', note: 'Agent 通过调用工具来行动。' },
  { a: '注意力', b: 'Attention', note: 'Attention 就是注意力机制。' },
  { a: '对齐', b: 'Alignment', note: 'Alignment 通常译作对齐。' },
];

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function init() {
  const root = document.querySelector('[data-match-game]');
  if (!root) return;

  const start = root.querySelector('[data-match-start]');
  const play = root.querySelector('[data-match-play]');
  const result = root.querySelector('[data-match-result]');
  const resultLabel = root.querySelector('[data-match-result-label]');
  const beginButton = root.querySelector('[data-match-begin]');
  const replayButton = root.querySelector('[data-match-replay]');
  const board = root.querySelector('[data-match-board]');
  const lines = root.querySelector('[data-match-lines]');
  const pairsEl = root.querySelector('[data-match-pairs]');
  const timeEl = root.querySelector('[data-match-time]');
  const scoreEl = root.querySelector('[data-match-score]');
  const statusEl = root.querySelector('[data-match-status]');
  const resultScore = root.querySelector('[data-match-result-score]');
  const resultTitle = root.querySelector('[data-match-result-title]');
  const resultNote = root.querySelector('[data-match-result-note]');
  const bestKey = 'aiuwei:attention-match.v1';

  let deck = [];
  let flipped = [];
  let matched = [];
  let score = 0;
  let pairCount = 0;
  let timeLeft = 60;
  let timer = null;
  let flipTimer = null;
  let running = false;
  let lock = false;

  function getBest() {
    try {
      return Number(localStorage.getItem(bestKey)) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      if (value > getBest()) localStorage.setItem(bestKey, String(value));
    } catch {
      /* localStorage can be unavailable. */
    }
  }

  function updateBar() {
    pairsEl.textContent = `${pairCount} / ${PAIRS.length}`;
    timeEl.textContent = String(timeLeft);
    scoreEl.textContent = String(score);
  }

  function drawLines() {
    if (!lines || !board) return;
    const boardRect = board.getBoundingClientRect();
    if (!boardRect.width || !boardRect.height) return;
    lines.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
    lines.replaceChildren();

    for (const [leftIndex, rightIndex] of matched) {
      const left = board.children[leftIndex];
      const right = board.children[rightIndex];
      if (!left || !right) continue;
      const a = left.getBoundingClientRect();
      const b = right.getBoundingClientRect();
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(a.left + a.width / 2 - boardRect.left));
      line.setAttribute('y1', String(a.top + a.height / 2 - boardRect.top));
      line.setAttribute('x2', String(b.left + b.width / 2 - boardRect.left));
      line.setAttribute('y2', String(b.top + b.height / 2 - boardRect.top));
      line.setAttribute('stroke', '#2647ff');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '4 4');
      line.setAttribute('opacity', '0.75');
      lines.appendChild(line);
    }
  }

  function renderBoard() {
    board.replaceChildren();
    lines.replaceChildren();
    deck.forEach((card, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'match-card';
      button.dataset.index = String(index);
      button.setAttribute('aria-label', `第 ${index + 1} 张卡，未翻开`);
      button.innerHTML = `
        <span class="match-card__front">${String(index + 1).padStart(2, '0')}</span>
        <span class="match-card__back">${card.text}</span>
      `;
      button.addEventListener('click', () => flip(index));
      board.appendChild(button);
    });
  }

  function flip(index) {
    if (!running || lock || flipped.includes(index)) return;
    const card = deck[index];
    const button = board.children[index];
    if (!card || !button || card.matched || button.classList.contains('is-flipped')) return;

    button.classList.add('is-flipped');
    button.setAttribute('aria-label', `第 ${index + 1} 张卡：${card.text}`);
    flipped.push(index);
    statusEl.textContent = flipped.length === 1 ? '再翻一张，找它的语义搭档。' : '看看它们是不是一对。';

    if (flipped.length < 2) return;

    const [first, second] = flipped;
    const firstCard = deck[first];
    const secondCard = deck[second];
    if (!firstCard || !secondCard) return;

    if (firstCard.id === secondCard.id) {
      firstCard.matched = true;
      secondCard.matched = true;
      matched.push([first, second]);
      pairCount += 1;
      score += 100;
      const firstButton = board.children[first];
      const secondButton = board.children[second];
      firstButton?.classList.add('is-matched');
      secondButton?.classList.add('is-matched');
      firstButton?.setAttribute('aria-label', `已配对：${firstCard.text}`);
      secondButton?.setAttribute('aria-label', `已配对：${secondCard.text}`);
      statusEl.textContent = `配对成功：${firstCard.text} ↔ ${secondCard.text}。${firstCard.note}`;
      flipped = [];
      updateBar();
      drawLines();

      if (pairCount === PAIRS.length) {
        end('clear');
      }
      return;
    }

    statusEl.textContent = '不是一对。记住它们的位置，再试一次。';
    lock = true;
    flipTimer = window.setTimeout(() => {
      for (const index of flipped) {
        const button = board.children[index];
        button?.classList.remove('is-flipped');
        button?.setAttribute('aria-label', `第 ${index + 1} 张卡，未翻开`);
      }
      flipped = [];
      lock = false;
      statusEl.textContent = '继续翻牌。';
    }, 720);
  }

  function end(reason) {
    if (!running && reason !== 'clear') return;
    running = false;
    lock = true;
    window.clearInterval(timer);
    window.clearTimeout(flipTimer);
    const timeBonus = reason === 'clear' ? timeLeft * 2 : 0;
    const finalScore = score + timeBonus;
    play.hidden = true;
    result.hidden = false;
    resultLabel.textContent = reason === 'clear' ? 'RESULT / 全部配对' : 'RESULT / 时间到';
    resultScore.textContent = String(finalScore);

    if (reason === 'clear') {
      resultTitle.textContent = '全部配对完成';
      resultNote.textContent = `6 对全部找到，剩余 ${timeLeft} 秒，时间奖励 ${timeBonus} 分。你的注意力和联想速度都很在线。`;
    } else {
      resultTitle.textContent = '时间到';
      resultNote.textContent = `找到 ${pairCount} 对，得分 ${finalScore}。${pairCount >= 4 ? '已经不错，再试一次可能就全清了。' : '先记住几组搭配，再挑战一次。'}`;
    }
    saveBest(finalScore);
  }

  function startGame() {
    window.clearInterval(timer);
    window.clearTimeout(flipTimer);
    deck = shuffle(
      PAIRS.flatMap((pair, id) => [
        { id, text: pair.a, note: pair.note, matched: false },
        { id, text: pair.b, note: pair.note, matched: false },
      ]),
    );
    flipped = [];
    matched = [];
    score = 0;
    pairCount = 0;
    timeLeft = 60;
    running = true;
    lock = false;
    start.hidden = true;
    result.hidden = true;
    play.hidden = false;
    updateBar();
    renderBoard();
    statusEl.textContent = '翻开两张卡，找语义相关的一对。';
    timer = window.setInterval(() => {
      timeLeft -= 1;
      timeEl.textContent = String(Math.max(0, timeLeft));
      if (timeLeft <= 0) {
        timeLeft = 0;
        timeEl.textContent = '0';
        end('timeout');
      }
    }, 1000);
  }

  beginButton?.addEventListener('click', startGame);
  replayButton?.addEventListener('click', startGame);
  window.addEventListener('resize', drawLines, { passive: true });
}

init();

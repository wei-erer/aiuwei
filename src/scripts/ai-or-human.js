const ROUNDS = [
  {
    prompt: '朋友第一次用 AI 写周报，问你最该注意什么。',
    a: '先让它写，再自己改。最容易翻车的是把没做的事写进去，所以事实要一条条核对。',
    b: '建议你明确周报的目标受众、核心信息与语气风格，提供必要背景，并仔细校对事实与格式，以确保内容准确、专业、得体。',
    answer: 'b',
    explain: 'B 更像 AI：结构完整、面面俱到，但几乎没有具体取舍。A 有“先写再改”“没做的事”这类真实经验。',
  },
  {
    prompt: '如何判断一个 RAG 项目是不是只会 demo？',
    a: '可以从检索召回率、引用准确率、上下文长度、延迟、失败案例和评测集覆盖度等维度建立系统评估体系，并持续迭代。',
    b: '看它敢不敢给你一条查不到的问题。Demo 只演示能答对的，项目要能解释为什么答错。',
    answer: 'a',
    explain: 'A 是典型的“维度齐全”答案：正确，但需要你自己再翻译成可执行动作。B 更像人的判断：用一个具体测试戳中 demo 的软肋。',
  },
  {
    prompt: '给一个完全没接触过 AI 的人解释 Agent。',
    a: '就像你让实习生去办事：他会自己查资料、用工具、遇到问题回来问你。模型是大脑，工具是手脚。',
    b: 'Agent 是一种能够感知环境、进行推理决策并采取行动以实现目标的智能系统，通常由规划、记忆、工具使用等模块组成。',
    answer: 'b',
    explain: 'B 是教科书式定义；A 用“实习生”类比，带具体场景。AI 也能写出好类比，但这题考察的是表达习惯，不是知识对错。',
  },
  {
    prompt: '老板让你评估要不要上多智能体框架。',
    a: '建议从业务复杂度、任务可分解性、协作收益、系统延迟、调试成本、失败模式与总体拥有成本等维度进行综合评估，形成阶段性结论。',
    b: '先问一句：单 Agent 是不是已经够了？多 Agent 最贵的地方不是 token，是出了问题没人知道该怪谁。',
    answer: 'a',
    explain: 'A 把所有正确的词都放了进去，但没有给出判断。B 有一个很具体的反常识观察：调试责任比 token 成本更贵。',
  },
  {
    prompt: '写一句给 AI 安全项目的招募文案。',
    a: '我们在找那种看到模型胡说八道会睡不着的人。不要求你已经发过论文，但希望你愿意把失败案例一条条记下来。',
    b: '我们正在寻找对 AI 安全充满热情的优秀人才，加入我们，共同构建可信、可靠、负责任的 AI 系统，为人类创造更美好的未来。',
    answer: 'b',
    explain: 'B 是标准的招聘套话：每个词都对，放在任何岗位都成立。A 有具体的行为和一点个人脾气。',
  },
  {
    prompt: '解释为什么 eval 比 benchmark 分数更重要。',
    a: 'Benchmark 提供标准化比较，eval 更贴近具体任务与失败模式。建议结合离线评测、人工评审、对抗测试和线上监控，建立多维评估体系。',
    b: '分数只能告诉你谁赢了，eval 才能告诉你它是怎么输的。线上真正要命的是那些 benchmark 没覆盖的边角。',
    answer: 'a',
    explain: 'A 仍然是“体系化”回答；B 用“怎么输的”“边角”把 eval 的价值讲成了一个具体判断。AI 可以写 B，但在这套题里，A 的泛化语气更明显。',
  },
];

function init() {
  const root = document.querySelector('[data-ai-game]');
  if (!root) return;

  const start = root.querySelector('[data-ai-start]');
  const play = root.querySelector('[data-ai-play]');
  const result = root.querySelector('[data-ai-result]');
  const beginButton = root.querySelector('[data-ai-begin]');
  const replayButton = root.querySelector('[data-ai-replay]');
  const nextButton = root.querySelector('[data-ai-next]');
  const progressEl = root.querySelector('[data-ai-progress]');
  const scoreEl = root.querySelector('[data-ai-score]');
  const promptEl = root.querySelector('[data-ai-prompt]');
  const aEl = root.querySelector('[data-ai-a]');
  const bEl = root.querySelector('[data-ai-b]');
  const choices = [...root.querySelectorAll('[data-ai-choice]')];
  const feedback = root.querySelector('[data-ai-feedback]');
  const verdictEl = root.querySelector('[data-ai-verdict]');
  const explainEl = root.querySelector('[data-ai-explain]');
  const resultScore = root.querySelector('[data-ai-result-score]');
  const resultTitle = root.querySelector('[data-ai-result-title]');
  const resultNote = root.querySelector('[data-ai-result-note]');
  const bestKey = 'aiuwei:human-or-ai.v1';

  let index = 0;
  let score = 0;
  let answered = false;

  const getBest = () => {
    try {
      return Number(localStorage.getItem(bestKey)) || 0;
    } catch {
      return 0;
    }
  };

  const saveBest = (value) => {
    try {
      const best = getBest();
      if (value > best) localStorage.setItem(bestKey, String(value));
    } catch {
      /* localStorage can be unavailable. */
    }
  };

  function render() {
    const round = ROUNDS[index];
    answered = false;
    progressEl.textContent = `第 ${index + 1} / ${ROUNDS.length} 题`;
    scoreEl.textContent = `${score} 分`;
    promptEl.textContent = round.prompt;
    aEl.textContent = round.a;
    bEl.textContent = round.b;
    feedback.hidden = true;
    choices.forEach((choice) => {
      choice.disabled = false;
      choice.classList.remove('is-correct', 'is-wrong', 'is-dim');
    });
  }

  function choose(value) {
    if (answered) return;
    answered = true;
    const round = ROUNDS[index];
    const correct = value === round.answer;
    if (correct) score += 1;

    choices.forEach((choice) => {
      choice.disabled = true;
      if (choice.dataset.aiChoice === round.answer) choice.classList.add('is-correct');
      if (choice.dataset.aiChoice === value && !correct) choice.classList.add('is-wrong');
      if (choice.dataset.aiChoice !== value && choice.dataset.aiChoice !== round.answer) {
        choice.classList.add('is-dim');
      }
    });

    scoreEl.textContent = `${score} 分`;
    verdictEl.textContent = correct ? '判断正确。' : '判断错了。';
    explainEl.textContent = round.explain;
    nextButton.querySelector('span:first-child').textContent =
      index === ROUNDS.length - 1 ? '看结果' : '下一题';
    feedback.hidden = false;
  }

  function finish() {
    play.hidden = true;
    start.hidden = true;
    result.hidden = false;
    resultScore.textContent = `${score} / ${ROUNDS.length}`;
    const ratio = score / ROUNDS.length;
    if (ratio === 1) {
      resultTitle.textContent = '人类观察员';
      resultNote.textContent = '全部判断正确。你不仅看结论，也在看表达方式。';
    } else if (ratio >= 0.83) {
      resultTitle.textContent = 'AI 识别力很强';
      resultNote.textContent = '大部分回答都判断对了。你已经能感觉到“正确但空泛”和“具体但有取舍”的差别。';
    } else if (ratio >= 0.66) {
      resultTitle.textContent = '不错的直觉';
      resultNote.textContent = '你抓住了大部分线索。下次可以多注意那些“每个词都对，但放在哪都成立”的句子。';
    } else if (ratio >= 0.5) {
      resultTitle.textContent = '还在学习';
      resultNote.textContent = '一半左右。别只看内容是否完整，也看看它有没有具体经验、取舍和一点人味。';
    } else {
      resultTitle.textContent = 'AI 比你更懂你';
      resultNote.textContent = '这次被“正确但空泛”的答案骗得有点多。再玩一次，注意那些过于完整、缺少取舍的句子。';
    }
    saveBest(score);
  }

  beginButton?.addEventListener('click', () => {
    index = 0;
    score = 0;
    start.hidden = true;
    play.hidden = false;
    result.hidden = true;
    render();
  });

  choices.forEach((choice) => {
    choice.addEventListener('click', () => choose(choice.dataset.aiChoice));
  });

  nextButton?.addEventListener('click', () => {
    if (index >= ROUNDS.length - 1) {
      finish();
      return;
    }
    index += 1;
    render();
  });

  replayButton?.addEventListener('click', () => {
    result.hidden = true;
    start.hidden = true;
    play.hidden = false;
    index = 0;
    score = 0;
    render();
  });
}

init();

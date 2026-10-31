export const BASE = import.meta.env.BASE_URL;

export const site = {
  name: 'AIUWEI',
  title: 'AIUWEI · 深空 AI 观测站',
  description:
    'wei_er 的 AI 观测站。记录 LLM、Agent、RAG 与 AI 安全方向的实验、项目与思考。',
  tagline: '在深空里，记录智能的微光。',
  author: 'wei_er',
  aiAlias: 'AIUWEI',
  github: 'https://github.com/wei-erer',
  repo: 'https://github.com/wei-erer/aiuwei',
  origin: 'https://wei-erer.github.io',
  email: '',
  established: '2026',
  focus: ['LLM / AGENT / RAG', 'AI SAFETY / ALIGNMENT'],
};

export const nav = [
  { label: '首页', en: 'HOME', path: '', index: '00' },
  { label: '项目', en: 'PROJECTS', path: 'projects/', index: '01' },
  { label: '记录', en: 'WRITING', path: 'writing/', index: '02' },
  { label: '实验室', en: 'LAB', path: 'lab/', index: '03' },
  { label: '关于', en: 'ABOUT', path: 'about/', index: '04' },
];

/** Prefix an internal path with the GitHub Pages base path. */
export function href(path = '') {
  if (
    /^(?:[a-z]+:)?\/\//i.test(path) ||
    path.startsWith('#') ||
    path.startsWith('mailto:') ||
    path.startsWith('tel:')
  ) {
    return path;
  }
  const base = BASE.endsWith('/') ? BASE : `${BASE}/`;
  return `${base}${path.replace(/^\/+/, '')}`;
}

export function canonical(path = '') {
  return new URL(href(path), site.origin).toString();
}

export const emptyCopy = {
  posts: {
    code: 'NO SIGNAL',
    title: '观测记录正在上传',
    body: '第一条记录还没抵达观测站。信号通道已经开启，等 wei_er 把它写下来。',
    prompt: 'wei_er@aiuwei:~$ awaiting first transmission_',
  },
  projects: {
    code: 'NO MISSION FILES',
    title: '任务档案尚未归档',
    body: '这里会放置实验、工具与独立项目。第一份任务档案还在深空里。',
    prompt: 'wei_er@aiuwei:~$ ls /missions --all',
  },
};

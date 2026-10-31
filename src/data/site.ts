export const BASE = import.meta.env.BASE_URL;

export const site = {
  name: 'AIUWEI',
  title: 'AIUWEI · 深空观测站',
  description:
    'wei_er 的 AI 观测站。记录 LLM、Agent 与 AI 安全方向的实验、项目和判断。',
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
  { label: '关于', en: 'ABOUT', path: 'about/', index: '03' },
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
    code: '000',
    title: '还没有记录',
    body: '等第一篇文章写完，它会出现在这里。不用占位内容凑数，也不假装这里已经有人读过。',
    link: '打开记录页',
  },
  projects: {
    code: '000',
    title: '任务档案尚未归档',
    body: '只归档能说清问题、方法和结果的东西。第一份可验证的档案还在准备中。',
    link: '查看项目页',
  },
};

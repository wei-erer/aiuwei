# AIUWEI · 深空 AI 观测站

wei_er 的个人 AI 博客。深空控制台视觉、可交互神经核心、开场动画、Markdown 文章系统和一款关于学习率调参的 Canvas 小游戏。

- 线上地址：`https://wei-erer.github.io/aiuwei/`
- 旧站：`https://wei-erer.github.io/`（未改动）
- 技术栈：Astro 7 + 原生 Canvas / CSS，静态输出，无后端
- 部署：GitHub Actions → GitHub Pages

## 本地开发

需要 Node.js 22+ 和 pnpm。

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:4321/aiuwei/`。生产构建：

```bash
pnpm build
pnpm preview
```

构建产物在 `dist/`。

## 写第一篇记录

在 `src/content/posts/` 新建 `.md` 文件即可。文件名会成为 URL slug，例如 `agent-memory.md` → `/aiuwei/writing/agent-memory/`。

```md
---
title: "一篇新的观测记录"
description: "一句话说明这篇记录解决了什么问题。"
pubDate: 2026-11-01
tags: ["LLM", "Agent"]
draft: false
---

正文从这里开始。
```

可用字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 文章标题 |
| `description` | 否 | 摘要，用于列表、SEO 和 RSS |
| `pubDate` | 是 | 发布日期，`YYYY-MM-DD` |
| `updatedDate` | 否 | 更新日期 |
| `tags` | 否 | 标签数组 |
| `draft` | 否 | 设为 `true` 不会发布 |
| `featured` | 否 | 预留给首页精选逻辑 |

模板在 `content-templates/post.md`。图片放到 `public/images/`，在文章里使用 `/aiuwei/images/文件名` 引用。

## 添加项目

项目不是 Markdown，而是一个类型化数组，入口在 `src/content/projects.ts`：

```ts
export const projects: Project[] = [
  {
    title: '项目名称',
    description: '它解决了什么问题，你做了什么。',
    year: '2026',
    status: 'experiment',
    stack: ['Python', 'LangGraph'],
    repo: 'https://github.com/wei-erer/example',
    order: 1,
  },
];
```

项目会自动出现在首页和 `/projects/`。`status` 可选 `active | archived | experiment | planned`。

## 改站名、标语和链接

站点身份集中在 `src/data/site.ts`：

```ts
export const site = {
  name: 'AIUWEI',
  title: 'AIUWEI · 深空 AI 观测站',
  tagline: '在深空里，记录智能的微光。',
  author: 'wei_er',
  github: 'https://github.com/wei-erer',
  ...
};
```

导航、页脚和 SEO 都会从这里读取。联系方式目前只公开 GitHub，没有放邮箱。

## 视觉与交互

- `src/components/IntroOverlay.astro` + `src/scripts/intro.js`：6 秒开场动画。可跳过，同一会话只播一次；`?intro=1` 强制重播。
- `src/scripts/neural-core.js`：首页和开场动画共用的粒子神经核心，支持鼠标视差和点击脉冲。
- `src/scripts/starfield.js`：全站固定星野、视差和流星。
- `src/components/LossValley.astro` + `src/scripts/gradient-game.js`：三关学习率 / 动量调参游戏。进度和最佳成绩存在浏览器 `localStorage`。
- `src/styles/global.css`：颜色、字体、间距、HUD 控件和动效 token。

游戏规则不是“训练真实模型”，而是一个关于优化直觉的互动实验；说明文案里已经明确这一点。

## 目录

```text
src/
  components/        页面组件、HUD、神经核心、游戏外壳
  content/posts/     Markdown 文章（目前为空）
  content/projects.ts 项目数组
  data/site.ts       站名、导航、链接、文案
  layouts/           BaseLayout
  lib/content.ts     Markdown 自动导入与文章数据
  pages/             首页、项目、记录、Lab、关于、404、RSS
  scripts/           星野、核心、开场、游戏、UI
  styles/            全局设计系统
public/              头像、OG 图、favicon、robots.txt
content-templates/   文章与项目模板
.github/workflows/   GitHub Pages 部署
```

## 部署

仓库：`wei-erer/aiuwei`。推送到 `main` 后，`.github/workflows/deploy.yml` 会自动构建并发布到 GitHub Pages。

首次部署需要在仓库 **Settings → Pages** 把 Source 设为 **GitHub Actions**。之后每次推送都会自动更新。

站点的 `base` 是 `/aiuwei`，对应项目页路径。如果以后迁移到 `wei-erer.github.io` 根域名，需要同时修改：

1. `astro.config.mjs` 的 `base`
2. `src/data/site.ts` 里的路径（使用 `href()` 的地方会自动跟随 `BASE`）
3. `public/robots.txt` 的 Sitemap 地址
4. 文章里的 `/aiuwei/images/...` 图片路径

## 说明

- 不包含评论、后台、数据库或访问统计。
- 不包含第三方字体 CDN；字体随构建打包。
- 已处理 `prefers-reduced-motion`：会跳过开场并关闭装饰性动效。
- 内容目前是空的：首页、记录页和项目页使用有意的“等待信号”空状态，没有编造项目或文章。

# AIUWEI · Paper Lab

wei_er 的个人 AI 博客。浅色纸感、编辑部式排版、互动封面、Markdown 文章系统，以及两个中文小游戏。

- 线上地址：`https://wei-erer.github.io/aiuwei/`
- 源码仓库：`https://github.com/wei-erer/aiuwei`
- 旧站：`https://wei-erer.github.io/`（未改动）
- 技术栈：Astro 7 + 原生 CSS / JS，静态输出，无后端
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

## 视觉与入口

- **Paper Lab**：暖白纸张、黑色墨线、酸性绿、钴蓝、橙色印章；没有暗色 HUD 和星野。
- **互动封面**：首次访问先看到封面，点击或按 Enter 进入；同一会话只出现一次。
- 页脚「重播封面」或访问 `?cover=1` 可以重新播放。
- 所有正文、按钮、游戏说明都使用高对比度浅色主题，正文至少 16px。

## 两个小游戏

都在 `/lab/`，规则页使用中文，不需要操作技巧：

1. **AI 真假判断**：每题两段文字，选出 AI 写的那段；6 题，答完给解析和评分。
2. **Token 注意力配对**：翻开两张卡，找出语义相关的一对；60 秒内完成 6 对。

游戏内容位置：

- AI 判断题库：`src/scripts/ai-or-human.js` 的 `ROUNDS`
- 配对词卡：`src/scripts/token-match.js` 的 `PAIRS`
- 游戏界面：`src/components/AiOrHuman.astro`、`src/components/TokenMatch.astro`

最佳成绩只存在浏览器 `localStorage`，不上传任何数据。

## 写第一篇记录

在 `src/content/posts/` 新建 `.md` 文件。文件名会成为 URL slug，例如 `agent-memory.md` → `/aiuwei/writing/agent-memory/`。

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

项目是一个类型化数组，入口在 `src/content/projects.ts`：

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

## 目录

```text
src/
  components/        页面组件、互动封面、两个游戏
  content/posts/     Markdown 文章（目前为空）
  content/projects.ts 项目数组
  data/site.ts       站名、导航、链接、文案
  layouts/           BaseLayout
  lib/content.ts     Markdown 自动导入与文章数据
  pages/             首页、项目、记录、Lab、关于、404、RSS
  scripts/           封面、UI、两个游戏、Lab tab
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
- 已处理 `prefers-reduced-motion`。
- 内容目前是空的：首页、记录页和项目页使用有意的空状态，没有编造项目或文章。

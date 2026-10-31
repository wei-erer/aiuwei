# AIUWEI · Orbital

wei_er 的个人 AI 博客。硬核科幻、深空轨道站、第一人称开场、Markdown 文章系统。

- 线上地址：`https://wei-erer.github.io/aiuwei/`
- 源码仓库：`https://github.com/wei-erer/aiuwei`
- 旧站：`https://wei-erer.github.io/`（未改动）
- 技术栈：Astro 7 + 原生 CSS / Canvas / Web Audio，静态输出，无后端
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

## 视觉与开场

- **Orbital**：深空黑、冷蓝行星、轨道站、细线金属、冷白文字。没有纸感、酸性绿和卡片网格。
- **第一人称开场**：点击启动后，信号锁定 → 星线拉伸 → 接近轨道站 → 对接灯亮起 → 开舱 → 进入观测站。约 8 秒。
- **声音**：Web Audio 合成低频、噪声、对接口提示音和冲击音；点击启动后才会播放，可随时关闭。
- **跳过**：右上角始终可以跳过；`prefers-reduced-motion` 会直接进入首页。
- **只出现一次**：会话内记住 `aiuwei:orbital-intro`；页脚「重播开场」或访问 `?intro=1` 可重看。
- **头像**：使用 `public/images/avatar.jpg` 原图，全站不做灰度、滤镜或去色处理。

## 内容结构

- 首页：轨道站主视觉 / 观测记录 / 项目档案 / 记录者 / 结束区。
- `/projects/`：项目档案，按问题、方法、结果归档。
- `/writing/`：观测记录列表。
- `/writing/[slug]/`：文章页。
- `/about/`：记录者档案。
- 404：信号丢失。
- 没有游戏页，也不再有问答或配对游戏。

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
  title: 'AIUWEI · 深空观测站',
  tagline: '在深空里，记录智能的微光。',
  author: 'wei_er',
  github: 'https://github.com/wei-erer',
  ...
};
```

导航、页脚和 SEO 都会从这里读取。联系方式目前只公开 GitHub，没有放邮箱。

## 开场 / 视觉参数

- 开场组件：`src/components/OrbitalIntro.astro`
- 开场动画与声音：`src/scripts/orbital-intro.js`
- 开场时长：`orbital-intro.js` 里的 `duration = 8200`
- 首页主视觉：`src/pages/index.astro`
- 全局颜色与字体：`src/styles/global.css`
- 页面头图：`src/components/PageHeader.astro`
- 头像：`public/images/avatar.jpg`

若不想让开场自动出现，把首页的 `<BaseLayout intro={true}>` 改成 `intro={false}`，或删除 `OrbitalIntro`。

## 目录

```text
src/
  components/        页面头、页头页脚、开场
  content/posts/     Markdown 文章（目前为空）
  content/projects.ts 项目数组
  data/site.ts       站名、导航、链接、文案
  layouts/           BaseLayout
  lib/content.ts     Markdown 自动导入与文章数据
  pages/             首页、项目、记录、关于、404、RSS
  scripts/           开场、UI
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
- 开场声音由 Web Audio 合成，没有外部音频文件。
- 内容目前是空的：首页、记录页和项目页使用有意的空状态，没有编造项目或文章。

export interface PostData {
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  tags: string[];
  draft: boolean;
  featured: boolean;
}

export interface PostHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface Post {
  slug: string;
  data: PostData;
  Content: any;
  headings: PostHeading[];
  raw: string;
}

type MarkdownModule = {
  frontmatter: Record<string, any>;
  Content: any;
  getHeadings?: () => PostHeading[];
  rawContent?: () => string;
};

const modules = import.meta.glob<MarkdownModule>('../content/posts/*.md', {
  eager: true,
});

function normalizeDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

export const allPosts: Post[] = Object.entries(modules)
  .map(([path, module]) => {
    const slug = path.split('/').pop()?.replace(/\.md$/, '') ?? '';
    const frontmatter = module.frontmatter ?? {};
    const pubDate = normalizeDate(frontmatter.pubDate) ?? new Date(0);
    return {
      slug,
      data: {
        title: String(frontmatter.title ?? slug),
        description: String(frontmatter.description ?? ''),
        pubDate,
        updatedDate: normalizeDate(frontmatter.updatedDate),
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
        draft: Boolean(frontmatter.draft),
        featured: Boolean(frontmatter.featured),
      },
      Content: module.Content,
      headings: module.getHeadings?.() ?? [],
      raw:
        typeof module.rawContent === 'function'
          ? module.rawContent()
          : '',
    };
  })
  .filter((post) => !post.data.draft)
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

export function getPosts(limit?: number): Post[] {
  return typeof limit === 'number' ? allPosts.slice(0, limit) : allPosts;
}

export function getPost(slug: string): Post | undefined {
  return allPosts.find((post) => post.slug === slug);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function readingTime(text: string): string {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const words = (text.match(/[A-Za-z0-9]+/g) ?? []).length;
  const minutes = Math.max(1, Math.round(chinese / 300 + words / 220));
  return `约 ${minutes} 分钟`;
}

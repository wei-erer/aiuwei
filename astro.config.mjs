import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://wei-erer.github.io',
  base: '/aiuwei',
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [sitemap()],
  vite: {
    resolve: {
      alias: {
        yaml: 'yaml/browser/index.js',
      },
    },
    ssr: {
      external: [],
    },
  },
  build: {
    format: 'directory',
  },
});

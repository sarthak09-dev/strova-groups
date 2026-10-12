import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://portal.strovagroups.in',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});

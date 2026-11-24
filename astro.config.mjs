import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.golfclub-euregio.de',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});

import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://golfeuregio.leonossendorf.de',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});

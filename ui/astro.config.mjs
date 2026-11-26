// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  adapter: netlify({ includeFiles: ['../data/micemax.db'] }),
  /* / serves the login page (kept alive); the bare root redirects to /home. */
  redirects: {
    '/': '/home',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

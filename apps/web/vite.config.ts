// Vite and Vitest settings: dev proxy to the API, access to the shared design folder, test setup.
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** The API of apps/api in development (npm run start:dev). */
const API_DEVELOPMENT_URL = process.env.API_URL ?? 'http://localhost:3000';
const designFolder = fileURLToPath(new URL('../../design', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    // The browser calls /api on this same server and Vite forwards it, so the API needs no CORS.
    proxy: {
      '/api': {
        target: API_DEVELOPMENT_URL,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    // Tokens and fonts live in design/, outside apps/web.
    fs: { allow: ['.', designFolder] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});

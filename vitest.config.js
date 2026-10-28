import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    // email-worker/src tests are pure (templates, recipients) — the socket
    // and entry modules are deliberately untested here: importing them
    // pulls in cloudflare:sockets, which only exists inside a Worker.
    include: ['src/**/*.{test,spec}.{js,jsx}', 'email-worker/src/**/*.{test,spec}.{js,jsx}'],
  },
});

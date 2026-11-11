/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const backend = process.env.SKYCAST_API_URL ?? 'http://localhost:8787';
// VITE_USE_FIXTURES=1 makes the API client answer from src/__fixtures__ (no backend needed).
// It is compiled to a literal so the fixture chunk is dead-code-eliminated from normal builds.
const useFixtures = process.env.VITE_USE_FIXTURES === '1';

export default defineConfig({
  plugins: [react()],
  define: {
    __USE_FIXTURES__: JSON.stringify(useFixtures),
  },
  resolve: {
    alias: {
      // Types-only module; the alias exists so editors/tests resolve it identically to tsc.
      '@contract': fileURLToPath(new URL('../shared/contract.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: backend, changeOrigin: true } },
    fs: { allow: ['..'] },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: backend, changeOrigin: true } },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 400,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
});

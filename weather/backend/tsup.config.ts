import { defineConfig } from 'tsup';

// Bundles src/server.ts into dist/server.js. The shared contract is imported
// type-only, so it is erased at build time and the Docker build context only
// needs this directory. Runtime dependencies stay external (node_modules).
export default defineConfig({
  entry: { server: 'src/server.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: false,
});

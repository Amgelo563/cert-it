import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    // the worker sits next to index.mjs, where BasePdfChecker looks for it
    entry: {
      index: 'src/index.ts',
      basePdfWorker: 'src/template/pdf/basePdfWorker.ts',
    },
    platform: 'node',
    format: ['esm'],
    sourcemap: true,
  },
  test: {
    name: 'server',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    environment: 'node',
    passWithNoTests: true,
  },
});

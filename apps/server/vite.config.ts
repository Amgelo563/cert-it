import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    // the workers sit next to index.mjs, where BasePdfChecker and BackgroundJobService look for them
    entry: {
      index: 'src/index.ts',
      basePdfWorker: 'src/template/pdf/basePdfWorker.ts',
      generator: 'src/generator/index.ts',
      backup: 'src/backup.ts',
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

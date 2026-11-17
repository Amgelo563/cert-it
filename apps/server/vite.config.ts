import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/index.ts'],
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

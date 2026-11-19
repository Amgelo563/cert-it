import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    deps: {
      // tsdown <0.23 compatibility: resolve external dependency subpaths.
      // Remove to preserve subpath imports as written (the new default).
      // https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
      resolveDepSubpath: true,
    },
    dts: {
      generator: 'tsgo',
    },
    exports: {
      // Adds a custom condition pointing at src, so workspace consumers get live types
      // (paired with customConditions in the base tsconfig).
      devExports: '@cert-it/source',
    },
  },
  test: {
    name: 'file',
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
    passWithNoTests: true,
    typecheck: { enabled: true, include: ['__tests__/**/*.test.ts'] },
  },
});

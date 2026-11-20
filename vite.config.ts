import { defineConfig } from 'vite-plus';

const Ignored = [
  '**/dist/**',
  '**/coverage/**',
  'apps/server/drizzle/**',
  'docs/**',
  'spikes/**',
  'packages/shared/src/index.ts',
  'packages/data/src/index.ts',
  'packages/file/src/index.ts',
  'packages/hono/src/index.ts',
  'packages/jobs/src/index.ts',
];

export default defineConfig({
  fmt: {
    ignorePatterns: [...Ignored, 'pnpm-lock.yaml'],
    printWidth: 80,
    tabWidth: 2,
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
    endOfLine: 'lf',
    experimentalOperatorPosition: 'start',
  },
  lint: {
    ignorePatterns: Ignored,
    plugins: ['typescript', 'import', 'vitest', 'oxc'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      'typescript/explicit-member-accessibility': [
        'error',
        { accessibility: 'explicit', overrides: { constructors: 'no-public' } },
      ],
      'typescript/no-floating-promises': 'error',
      'typescript/await-thenable': 'error',
      'typescript/require-await': 'error',
      'typescript/consistent-type-imports': 'error',
      'typescript/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      'typescript/no-explicit-any': 'off',
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        files: ['apps/admin/**'],
        plugins: ['react', 'react-perf', 'jsx-a11y'],
        rules: {
          'react/rules-of-hooks': 'error',
          'react/only-export-components': [
            'warn',
            { allowConstantExport: true },
          ],
        },
      },
    ],
  },
  run: {
    // cache package.json scripts too (build, test), so unchanged packages are skipped
    cache: { scripts: true, tasks: true },
  },
  staged: {
    '*.{ts,tsx}': 'vp check --fix',
  },
  test: {
    projects: [
      'packages/shared',
      'packages/file',
      'packages/data',
      'apps/server',
      'apps/admin',
    ],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['**/src/**/*.{ts,tsx}'],
      exclude: [
        '**/Abstract*.{ts,tsx}',
        '**/*Error.ts',
        '**/*.config.ts',
        '**/__tests__/**',
        '**/dist/**',
      ],
    },
  },
});

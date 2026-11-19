import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {brotliCompress, constants, gzip} from 'node:zlib';
import react from '@vitejs/plugin-react';
import postcssPresetMantine from 'postcss-preset-mantine';
import postcssSimpleVars from 'postcss-simple-vars';
import {defineConfig, lazyPlugins, type Plugin} from 'vite-plus';

const DevBasePath = '/admin/';

const CompressibleFile = /\.(js|mjs|css|svg|json|wasm|txt)$/;

const CompressMinBytes = 1024;

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

function devBaseTag(): Plugin {
  return {
    name: 'cert-it:dev-base-tag',
    apply: 'serve',
    transformIndexHtml: () => [
      {tag: 'base', attrs: {href: DevBasePath}, injectTo: 'head-prepend'},
    ],
  };
}

// writes .br and .gz next to each asset, served by the app server as they are (precompressed)
function compressAssets(): Plugin {
  let outDir = 'dist';

  return {
    name: 'cert-it:compress-assets',
    apply: 'build',
    configResolved: (config) => {
      outDir = config.build.outDir;
    },
    closeBundle: async () => {
      const files = await readdir(outDir, {recursive: true});

      await Promise.all(
        files
          .filter((file) => CompressibleFile.test(file))
          .map(async (file) => {
            const path = join(outDir, file);
            const content = await readFile(path);
            if (content.byteLength < CompressMinBytes) return;

            await writeFile(
              `${path}.br`,
              await brotli(content, {
                params: {[constants.BROTLI_PARAM_QUALITY]: 11},
              }),
            );
            await writeFile(
              `${path}.gz`,
              await gzipAsync(content, {level: 9}),
            );
          }),
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({command}) => ({
  // relative asset paths, so one build works at / or under any base path
  base: command === 'build' ? './' : DevBasePath,
  plugins: lazyPlugins(() => [react(), devBaseTag(), compressAssets()]),
  css: {
    postcss: {
      plugins: [
        postcssPresetMantine(),
        postcssSimpleVars({
          variables: {
            'mantine-breakpoint-xs': '36em',
            'mantine-breakpoint-sm': '48em',
            'mantine-breakpoint-md': '62em',
            'mantine-breakpoint-lg': '75em',
            'mantine-breakpoint-xl': '88em',
          },
        }),
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 8000,
  },
  test: {
    name: 'admin',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
}));

import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { ThemeValues } from '@cert-it/shared';
import { defineConfig, type Plugin } from 'vite-plus';

const ThemeModuleID = 'virtual:theme.css';

const CompressibleFile = /\.(js|mjs|css|svg|json|ttf|pfb|txt)$/;

const CompressMinBytes = 1024;

// JS decoders pdf.js loads when WebAssembly is off, and its replacements for non-embedded fonts
const PdfjsFiles = [
  { from: 'wasm', to: 'wasm', match: /_nowasm_fallback\.js$|^LICENSE/ },
  { from: 'standard_fonts', to: 'standard_fonts', match: /./ },
];

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

// the shared theme values as CSS custom properties, so the pages match the admin panel
function themeVariables(): Plugin {
  const resolvedID = `\0${ThemeModuleID}`;

  return {
    name: 'cert-it:theme-variables',
    resolveId: (id) => (id === ThemeModuleID ? resolvedID : null),
    load: (id) => {
      if (id !== resolvedID) return null;

      const shades = (name: string, values: readonly string[]) =>
        values.map((value, i) => `--${name}-${i}: ${value};`);
      const lines = [
        ...shades('brand', ThemeValues.brandShades),
        ...shades('neutral', ThemeValues.neutralShades),
        ...shades('dark', ThemeValues.darkShades),
        `--brand: var(--brand-${ThemeValues.brandShadeIndex});`,
        `--brand-on-dark: var(--brand-${ThemeValues.brandShadeIndexDark});`,
        `--radius: ${ThemeValues.radiusPx}px;`,
        `--shadow-sm: ${ThemeValues.shadows.small};`,
        `--shadow-md: ${ThemeValues.shadows.medium};`,
        `--font: ${ThemeValues.fontFamily};`,
        `--font-mono: ${ThemeValues.monospaceFontFamily};`,
      ];
      return `:root {\n  ${lines.join('\n  ')}\n}\n`;
    },
  };
}

// copies them under a versioned folder, next to the assets that load them
function copyPdfjsFiles(): Plugin {
  const require = createRequire(import.meta.url);
  const manifest = require.resolve('pdfjs-dist/package.json');
  const root = dirname(manifest);
  let outDir = 'dist';

  return {
    name: 'cert-it:copy-pdfjs-files',
    apply: 'build',
    configResolved: (config) => {
      outDir = config.build.outDir;
    },
    // closeBundle compresses them afterwards
    writeBundle: async () => {
      const { version } = JSON.parse(await readFile(manifest, 'utf8')) as {
        version: string;
      };

      for (const { from, to, match } of PdfjsFiles) {
        const target = join(outDir, 'pdfjs', version, to);
        await mkdir(target, { recursive: true });

        for (const file of await readdir(join(root, from))) {
          if (match.test(file)) {
            await copyFile(join(root, from, file), join(target, file));
          }
        }
      }
    },
  };
}

// writes .br and .gz next to each file, served by the app server as they are (precompressed)
function compressAssets(): Plugin {
  let outDir = 'dist';

  return {
    name: 'cert-it:compress-assets',
    apply: 'build',
    configResolved: (config) => {
      outDir = config.build.outDir;
    },
    closeBundle: async () => {
      const files = await readdir(outDir, { recursive: true });

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
                params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
              }),
            );
            await writeFile(
              `${path}.gz`,
              await gzipAsync(content, { level: 9 }),
            );
          }),
      );
    },
  };
}

export default defineConfig({
  // relative asset paths, so one build works at / or under any base path
  base: './',
  plugins: [themeVariables(), copyPdfjsFiles(), compressAssets()],
  publicDir: false,
  build: {
    // read by the app server to link each page's script and styles
    manifest: true,
    // pdf.js and its worker are large by nature
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        certificate: 'src/certificate/certificatePage.ts',
      },
    },
  },
  test: {
    name: 'public',
    include: ['__tests__/**/*.test.ts'],
    passWithNoTests: true,
  },
});

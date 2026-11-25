import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

/** Page of the fake build, shaped like Vite's output with relative asset paths. */
export const AdminBuildIndexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <title>cert-it admin</title>
    <script type="module" crossorigin src="./assets/index-abc123.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>
`;

export const AdminBuildScript = 'console.log("admin");';

/** Writes a fake admin build to a temporary directory; returns it and a cleanup. */
export function createAdminBuild(): { directory: string; remove: () => void } {
  const directory = mkdtempSync(join(tmpdir(), 'cert-it-admin-'));
  mkdirSync(join(directory, 'assets'));

  writeFileSync(join(directory, 'index.html'), AdminBuildIndexHtml);
  writeFileSync(join(directory, 'favicon.svg'), '<svg></svg>');
  writeFileSync(join(directory, 'assets', 'index-abc123.js'), AdminBuildScript);
  writeFileSync(
    join(directory, 'assets', 'index-abc123.js.br'),
    brotliCompressSync(AdminBuildScript),
  );

  return {
    directory,
    remove: () => rmSync(directory, { recursive: true, force: true }),
  };
}

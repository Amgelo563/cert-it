import { join } from 'node:path';
import { build } from 'esbuild';

/** Bundles the test worker into a single file in the given folder, returning its path. */
export async function buildTestWorker(directory: string): Promise<string> {
  const outfile = join(directory, 'testWorker.mjs');
  await build({
    entryPoints: [join(import.meta.dirname, 'testWorker.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outfile,
    logLevel: 'silent',
  });

  return outfile;
}

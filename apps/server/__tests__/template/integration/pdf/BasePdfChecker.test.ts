import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { BasePdfChecker } from '../../../../src/template/pdf/BasePdfChecker';
import { BasePdfProblemEnum } from '../../../../src/template/pdf/BasePdfProblemEnum';
import { createPdf } from '../../mocks/createPdf';

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cert-it-pdf-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function file(name: string, content: Uint8Array | string): string {
  const path = join(directory, name);
  writeFileSync(path, content);
  return path;
}

describe('BasePdfChecker', () => {
  test('GIVEN a one-page PDF WHEN checking THEN accepts it', async () => {
    const result = await BasePdfChecker.create().check(
      file('one.pdf', await createPdf(1)),
    );

    expect(result.isOk()).toBe(true);
  });

  test('GIVEN a two-page PDF WHEN checking THEN reports not_one_page', async () => {
    const result = await BasePdfChecker.create().check(
      file('two.pdf', await createPdf(2)),
    );

    expect(result.isErr() && result.error.problem).toBe(
      BasePdfProblemEnum.NotOnePage,
    );
  });

  test('GIVEN a file that is not a PDF WHEN checking THEN reports invalid', async () => {
    const result = await BasePdfChecker.create().check(
      file('bad.pdf', 'hello'),
    );

    expect(result.isErr() && result.error.problem).toBe(
      BasePdfProblemEnum.Invalid,
    );
  });

  test('GIVEN more checks than maxConcurrent WHEN checking THEN runs at most that many workers at once', async () => {
    let running = 0;
    let peak = 0;
    class CountingChecker extends BasePdfChecker {
      protected override async runWorker(path: string) {
        running++;
        peak = Math.max(peak, running);
        try {
          return await super.runWorker(path);
        } finally {
          running--;
        }
      }
    }
    const checker = new CountingChecker({ maxConcurrent: 2 });
    const path = file('one.pdf', await createPdf(1));

    const results = await Promise.all(
      Array.from({ length: 5 }, () => checker.check(path)),
    );

    expect(results.every((result) => result.isOk())).toBe(true);
    expect(peak).toBe(2);
  });

  test('GIVEN a missing file WHEN checking THEN throws', async () => {
    await expect(
      BasePdfChecker.create().check(join(directory, 'missing.pdf')),
    ).rejects.toThrow(/ENOENT/);
  });
});

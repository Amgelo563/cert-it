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
    const result = await new BasePdfChecker().check(
      file('one.pdf', await createPdf(1)),
    );

    expect(result.isOk()).toBe(true);
  });

  test('GIVEN a two-page PDF WHEN checking THEN reports not_one_page', async () => {
    const result = await new BasePdfChecker().check(
      file('two.pdf', await createPdf(2)),
    );

    expect(result.isErr() && result.error.problem).toBe(
      BasePdfProblemEnum.NotOnePage,
    );
  });

  test('GIVEN a file that is not a PDF WHEN checking THEN reports invalid', async () => {
    const result = await new BasePdfChecker().check(file('bad.pdf', 'hello'));

    expect(result.isErr() && result.error.problem).toBe(
      BasePdfProblemEnum.Invalid,
    );
  });

  test('GIVEN a missing file WHEN checking THEN throws', async () => {
    await expect(
      new BasePdfChecker().check(join(directory, 'missing.pdf')),
    ).rejects.toThrow(/ENOENT/);
  });
});

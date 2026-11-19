import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { CertificateCode } from '../../../src/certificate/code/CertificateCode';
import type { CourseId } from '../../../src/course/Course';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';

let parent: string;
let root: string;

beforeEach(() => {
  parent = mkdtempSync(join(tmpdir(), 'cert-it-data-'));
  root = join(parent, 'data');
});

afterEach(() => {
  rmSync(parent, { recursive: true, force: true });
});

describe('DataDirectoryService (start)', () => {
  test('GIVEN a missing directory WHEN starting THEN creates it with its folders', () => {
    new DataDirectoryService({ root }).start();

    for (const folder of ['fonts', 'templates', 'certificates']) {
      expect(existsSync(join(root, folder))).toBe(true);
    }
  });

  test('GIVEN a directory with files WHEN starting again THEN keeps them', () => {
    const directory = new DataDirectoryService({ root });
    directory.start();
    const font = directory.getFontPath('abc.ttf');
    writeFileSync(font, 'font');

    directory.start();

    expect(existsSync(font)).toBe(true);
  });

  test('GIVEN a path under a file WHEN starting THEN throws', () => {
    const file = join(parent, 'file');
    writeFileSync(file, '');

    expect(() =>
      new DataDirectoryService({ root: join(file, 'data') }).start(),
    ).toThrow(/EEXIST|ENOTDIR/);
  });
});

describe('DataDirectoryService (start, temporary files)', () => {
  test('GIVEN temporary files left by a crash WHEN starting THEN removes them and keeps the rest', () => {
    const certificates = join(root, 'certificates', '7');
    mkdirSync(certificates, { recursive: true });
    const pdf = join(certificates, 'ABCD-EFGH-JK.pdf');
    writeFileSync(pdf, 'pdf');
    writeFileSync(`${pdf}.0b6f1c3e.tmp`, 'partial');

    new DataDirectoryService({ root }).start();

    expect(readdirSync(certificates)).toEqual(['ABCD-EFGH-JK.pdf']);
  });
});

describe('DataDirectoryService (writeFile)', () => {
  test('GIVEN a file in a missing folder WHEN writing THEN creates the folder and the file', async () => {
    const directory = new DataDirectoryService({ root });
    const path = directory.getTemplatePath(3 as CourseId, 1);

    await directory.writeFile(path, 'pdf');

    expect(readFileSync(path, 'utf8')).toBe('pdf');
  });

  test('GIVEN an existing file WHEN writing THEN replaces it and leaves no temporary file', async () => {
    const directory = new DataDirectoryService({ root });
    directory.start();
    const path = directory.getFontPath('abc.ttf');
    writeFileSync(path, 'old');

    await directory.writeFile(path, new Uint8Array([110, 101, 119]));

    expect(readFileSync(path, 'utf8')).toBe('new');
    expect(readdirSync(join(root, 'fonts'))).toEqual(['abc.ttf']);
  });

  test('GIVEN content that fails mid-write WHEN writing THEN keeps the old file and leaves no temporary file', async () => {
    const directory = new DataDirectoryService({ root });
    directory.start();
    const path = directory.getFontPath('abc.ttf');
    writeFileSync(path, 'old');

    async function* failing(): AsyncGenerator<string> {
      yield 'partial';
      await Promise.resolve();
      throw new Error('stream failed');
    }

    await expect(directory.writeFile(path, failing())).rejects.toThrow(
      'stream failed',
    );
    expect(readFileSync(path, 'utf8')).toBe('old');
    expect(readdirSync(join(root, 'fonts'))).toEqual(['abc.ttf']);
  });
});

describe('DataDirectoryService (paths)', () => {
  test('GIVEN a relative root WHEN getting paths THEN resolves them from the working directory', () => {
    const directory = new DataDirectoryService({ root: 'data' });

    expect(directory.getDatabasePath()).toBe(
      join(process.cwd(), 'data', 'app.db'),
    );
  });

  test('GIVEN a course and version WHEN getting file paths THEN follows the STO-1 layout', () => {
    const directory = new DataDirectoryService({ root });
    const courseId = 7 as CourseId;

    expect(directory.getFontPath('abc.ttf')).toBe(
      join(root, 'fonts', 'abc.ttf'),
    );
    expect(directory.getTemplatePath(courseId, 2)).toBe(
      join(root, 'templates', '7', 'v2.pdf'),
    );
    expect(
      directory.getCertificatePath(courseId, 'ABCD-EFGH-JK' as CertificateCode),
    ).toBe(join(root, 'certificates', '7', 'ABCD-EFGH-JK.pdf'));
  });
});

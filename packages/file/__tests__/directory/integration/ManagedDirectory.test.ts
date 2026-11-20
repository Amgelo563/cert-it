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
import { FileSystemError } from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { ManagedDirectory } from '../../../src/shared/directory/ManagedDirectory';

let parent: string;
let root: string;

beforeEach(() => {
  parent = mkdtempSync(join(tmpdir(), 'file-directory-'));
  root = join(parent, 'data');
});

afterEach(() => {
  rmSync(parent, { recursive: true, force: true });
});

describe('ManagedDirectory (start)', () => {
  test('GIVEN a missing directory WHEN starting THEN creates it with its folders', () => {
    new ManagedDirectory({ root, folders: ['a', join('b', 'c')] }).start();

    expect(existsSync(join(root, 'a'))).toBe(true);
    expect(existsSync(join(root, 'b', 'c'))).toBe(true);
  });

  test('GIVEN temporary files left by a crash WHEN starting THEN removes them and keeps the rest', () => {
    const folder = join(root, 'a', 'b');
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'file.pdf'), 'pdf');
    writeFileSync(join(folder, 'file.pdf.0b6f1c3e.tmp'), 'partial');

    new ManagedDirectory({ root }).start();

    expect(readdirSync(folder)).toEqual(['file.pdf']);
  });

  test('GIVEN a path under a file WHEN starting THEN throws', () => {
    const file = join(parent, 'file');
    writeFileSync(file, '');

    expect(() =>
      new ManagedDirectory({ root: join(file, 'data') }).start(),
    ).toThrow(/EEXIST|ENOTDIR/);
  });
});

describe('ManagedDirectory (writeFile)', () => {
  test('GIVEN a file in a missing folder WHEN writing THEN creates the folder and the file', async () => {
    const directory = new ManagedDirectory({ root });

    const result = await directory.writeFile(join('a', 'file.txt'), 'text');

    expect(result.isOk()).toBe(true);
    expect(readFileSync(join(root, 'a', 'file.txt'), 'utf8')).toBe('text');
  });

  test('GIVEN an existing file WHEN writing with its absolute path THEN replaces it and leaves no temporary file', async () => {
    const directory = new ManagedDirectory({ root });
    directory.start();
    const path = directory.resolve('file.txt');
    writeFileSync(path, 'old');

    await directory.writeFile(path, new Uint8Array([110, 101, 119]));

    expect(readFileSync(path, 'utf8')).toBe('new');
    expect(readdirSync(root)).toEqual(['file.txt']);
  });

  test('GIVEN content that fails mid-write WHEN writing THEN returns a FileSystemError, keeps the old file and leaves no temporary file', async () => {
    const directory = new ManagedDirectory({ root });
    directory.start();
    const path = directory.resolve('file.txt');
    writeFileSync(path, 'old');

    async function* failing(): AsyncGenerator<string> {
      yield 'partial';
      await Promise.resolve();
      throw new Error('stream failed');
    }

    const result = await directory.writeFile(path, failing());

    expect(result.isErr() && FileSystemError.is(result.error)).toBe(true);
    expect(result.isErr() && result.error.cause.message).toBe('stream failed');
    expect(readFileSync(path, 'utf8')).toBe('old');
    expect(readdirSync(root)).toEqual(['file.txt']);
  });

  test('GIVEN a path outside the directory WHEN writing THEN throws and writes nothing', async () => {
    const directory = new ManagedDirectory({ root });

    await expect(
      directory.writeFile(join('..', 'escape.txt'), 'x'),
    ).rejects.toThrow(/outside/);
    expect(existsSync(join(parent, 'escape.txt'))).toBe(false);
  });
});

describe('ManagedDirectory (resolve)', () => {
  test('GIVEN a relative root WHEN resolving THEN starts from the working directory', () => {
    expect(new ManagedDirectory({ root: 'data' }).resolve('app.db')).toBe(
      join(process.cwd(), 'data', 'app.db'),
    );
  });

  test.each([['..', 'x'], [tmpdir()], ['a', '..', '..', 'x']])(
    'GIVEN the segments %j that leave the directory WHEN resolving THEN throws',
    (...segments) => {
      expect(() => new ManagedDirectory({ root }).resolve(...segments)).toThrow(
        /outside/,
      );
    },
  );
});

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { AlreadyExistsFileWriteError } from '../../../src/shared/io/errors/write/AlreadyExistsFileWriteError';
import { YamlIO } from '../../../src/yaml/io/YamlIO';

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'file-yaml-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('YamlIO (write)', () => {
  test('GIVEN no file WHEN writing THEN creates it with the extension added', async () => {
    const path = join(directory, 'settings');

    const result = await YamlIO.Instance.write({ data: { a: 1 }, path });

    expect(result.isOk()).toBe(true);
    expect(readFileSync(`${path}.yml`, 'utf-8')).toBe('a: 1\n');
  });

  test('GIVEN an existing file WHEN writing without overwriting THEN returns an AlreadyExistsFileWriteError and keeps it', async () => {
    const path = join(directory, 'settings.yml');
    writeFileSync(path, 'a: 1\n');

    const result = await YamlIO.Instance.write({ data: { a: 2 }, path });

    expect(result.isErr() && AlreadyExistsFileWriteError.is(result.error)).toBe(
      true,
    );
    expect(readFileSync(path, 'utf-8')).toBe('a: 1\n');
  });

  test('GIVEN an existing file WHEN writing with overwriting THEN replaces it', async () => {
    const path = join(directory, 'settings.yml');
    writeFileSync(path, 'a: 1\n');

    const result = await YamlIO.Instance.write({
      data: { a: 2 },
      path,
      overwriteIfPresent: true,
    });

    expect(result.isOk()).toBe(true);
    expect(readFileSync(path, 'utf-8')).toBe('a: 2\n');
  });

  test('GIVEN the camelized instance WHEN writing what it read THEN keeps the snake_case keys', async () => {
    const path = join(directory, 'settings.yml');
    writeFileSync(path, 'max_items: 3\nnested:\n  - inner_key: true\n');

    const read = (await YamlIO.CamelizedInstance.read(path)).unwrap();
    const result = await YamlIO.CamelizedInstance.write({
      data: read,
      path,
      overwriteIfPresent: true,
    });

    expect(read).toEqual({ maxItems: 3, nested: [{ innerKey: true }] });
    expect(result.isOk()).toBe(true);
    expect(readFileSync(path, 'utf-8')).toBe(
      'max_items: 3\nnested:\n  - inner_key: true\n',
    );
  });
});

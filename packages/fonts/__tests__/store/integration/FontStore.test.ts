import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { InvalidFontError } from '../../../src/font/errors/InvalidFontError';
import { FontStore } from '../../../src/node/store/FontStore';
import { readFixture } from '../../font/mocks/readFixture';

const Font = readFixture('basic.ttf');

const Sha256 = createHash('sha256').update(Font).digest('hex');

let parent: string;
let directory: string;
let store: FontStore;

beforeEach(() => {
  parent = mkdtempSync(join(tmpdir(), 'fonts-store-'));
  directory = join(parent, 'fonts');
  store = FontStore.create({ directory });
  store.start();
});

afterEach(() => {
  rmSync(parent, { recursive: true, force: true });
});

describe('FontStore (save)', () => {
  test('GIVEN a font WHEN saving THEN writes it as <sha256>.<ext> and returns its details', async () => {
    const stored = (await store.save(Font)).unwrap();

    expect(stored).toEqual({
      family: 'Inter',
      style: 'Regular',
      extension: 'ttf',
      variable: false,
      sha256: Sha256,
      fileName: `${Sha256}.ttf`,
    });
    expect(readdirSync(directory)).toEqual([`${Sha256}.ttf`]);
  });

  test('GIVEN an OTF font WHEN saving THEN names it .otf', async () => {
    const stored = (await store.save(readFixture('basic.otf'))).unwrap();

    expect(stored.fileName).toMatch(/^[0-9a-f]{64}\.otf$/);
  });

  test('GIVEN a font already saved WHEN saving it again THEN writes nothing and returns the same details', async () => {
    const first = (await store.save(Font)).unwrap();
    writeFileSync(store.getPath(first.fileName), 'kept');

    const second = (await store.save(Font)).unwrap();

    expect(second).toEqual(first);
    expect(readdirSync(directory)).toEqual([first.fileName]);
  });

  test('GIVEN a file that is not a usable font WHEN saving THEN returns InvalidFontError and writes nothing', async () => {
    const result = await store.save(readFixture('basic.woff2'));

    expect(result.isErr() && InvalidFontError.is(result.error)).toBe(true);
    expect(readdirSync(directory)).toEqual([]);
  });
});

describe('FontStore (delete)', () => {
  test('GIVEN a saved font WHEN deleting it THEN removes the file', async () => {
    const { fileName } = (await store.save(Font)).unwrap();

    const result = await store.delete(fileName);

    expect(result.isOk()).toBe(true);
    expect(existsSync(store.getPath(fileName))).toBe(false);
  });

  test('GIVEN a font that is already gone WHEN deleting it THEN succeeds', async () => {
    expect((await store.delete(`${Sha256}.ttf`)).isOk()).toBe(true);
  });
});

describe('FontStore (getPath)', () => {
  test('GIVEN a stored font name WHEN getting its path THEN returns it inside the folder', () => {
    expect(store.getPath(`${Sha256}.otf`)).toBe(
      join(directory, `${Sha256}.otf`),
    );
  });

  test.each([
    join('..', 'app.db'),
    `${Sha256}.pdf`,
    `${Sha256.toUpperCase()}.ttf`,
    'font.ttf',
  ])('GIVEN the name %s WHEN getting its path THEN throws', (name) => {
    expect(() => store.getPath(name)).toThrow(/not the name of a stored font/);
  });
});

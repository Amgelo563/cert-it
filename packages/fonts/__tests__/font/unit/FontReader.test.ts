import { describe, expect, test } from 'vite-plus/test';
import { InvalidFontError } from '../../../src/font/errors/InvalidFontError';
import { FontReader } from '../../../src/font/FontReader';
import {
  type InvalidFontReason,
  InvalidFontReasonEnum,
} from '../../../src/font/InvalidFontReasonEnum';
import { readFixture } from '../mocks/readFixture';

const reader = FontReader.Instance;

describe('FontReader (read)', () => {
  test('GIVEN a TrueType font WHEN reading THEN returns its family, style and ttf', () => {
    expect(reader.read(readFixture('basic.ttf')).unwrap()).toEqual({
      family: 'Inter',
      style: 'Regular',
      extension: 'ttf',
      variable: false,
    });
  });

  test('GIVEN an OpenType font with CFF outlines WHEN reading THEN returns otf', () => {
    const info = reader.read(readFixture('basic.otf')).unwrap();

    expect(info).toMatchObject({ family: 'Inconsolata', extension: 'otf' });
  });

  test('GIVEN a variable font WHEN reading THEN says so', () => {
    const info = reader.read(readFixture('variable.ttf')).unwrap();

    expect(info).toMatchObject({ family: 'Inter', variable: true });
  });

  test.each<[string, Uint8Array, InvalidFontReason]>([
    ['a WOFF2', readFixture('basic.woff2'), InvalidFontReasonEnum.WebFormat],
    [
      'a collection',
      readFixture('collection.ttc'),
      InvalidFontReasonEnum.Collection,
    ],
    [
      'random bytes',
      new Uint8Array([1, 2, 3, 4, 5]),
      InvalidFontReasonEnum.Unreadable,
    ],
    ['an empty file', new Uint8Array(), InvalidFontReasonEnum.Unreadable],
    [
      'a broken TrueType file',
      readFixture('basic.ttf').subarray(0, 64),
      InvalidFontReasonEnum.Unreadable,
    ],
  ])(
    'GIVEN %s WHEN reading THEN returns InvalidFontError %s',
    (_, bytes, reason) => {
      const result = reader.read(bytes);

      expect(
        result.isErr()
          && InvalidFontError.is(result.error)
          && result.error.reason,
      ).toBe(reason);
    },
  );
});

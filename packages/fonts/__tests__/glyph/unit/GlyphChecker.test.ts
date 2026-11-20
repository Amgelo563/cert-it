import { describe, expect, test } from 'vite-plus/test';
import { InvalidFontError } from '../../../src/font/errors/InvalidFontError';
import { GlyphChecker } from '../../../src/glyph/GlyphChecker';
import { readFixture } from '../../font/mocks/readFixture';

// the fixture has printable ASCII and é, nothing else
const checker = GlyphChecker.fromBytes(readFixture('basic.ttf')).unwrap();

describe('GlyphChecker (findMissing)', () => {
  test('GIVEN a name the font fully covers WHEN checking THEN returns nothing', () => {
    expect(checker.findMissing('René Smith')).toEqual([]);
    expect(checker.covers('René Smith')).toBe(true);
  });

  test('GIVEN characters the font lacks WHEN checking THEN returns each once, in order', () => {
    expect(checker.findMissing('Nguyễn Żółć Ż')).toEqual([
      'ễ',
      'Ż',
      'ó',
      'ł',
      'ć',
    ]);
    expect(checker.covers('Nguyễn')).toBe(false);
  });

  test('GIVEN an accent typed as a separate mark WHEN checking THEN joins it to its letter first', () => {
    expect(checker.findMissing('René'.normalize('NFD'))).toEqual([]);
  });

  test('GIVEN spaces, tabs and line breaks the font may lack WHEN checking THEN skips them', () => {
    expect(checker.findMissing('a\tb\nc d')).toEqual([]);
  });

  test('GIVEN a character outside the basic plane WHEN checking THEN returns it whole', () => {
    expect(checker.findMissing('A😀')).toEqual(['😀']);
  });
});

describe('GlyphChecker (fromBytes)', () => {
  test('GIVEN bytes that are not a usable font WHEN creating THEN returns InvalidFontError', () => {
    const result = GlyphChecker.fromBytes(readFixture('basic.woff2'));

    expect(result.isErr() && InvalidFontError.is(result.error)).toBe(true);
  });
});

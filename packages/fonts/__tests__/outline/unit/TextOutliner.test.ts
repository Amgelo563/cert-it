import { describe, expect, test } from 'vite-plus/test';
import { TextOutliner } from '../../../src/outline/TextOutliner';
import { readFixture } from '../../font/mocks/readFixture';

describe('TextOutliner', () => {
  test.each(['basic.ttf', 'basic.otf'])(
    'GIVEN a font (%s) WHEN outlining text THEN draws whole-unit SVG path data in a box from ascent to descent',
    (fixture) => {
      const outliner = TextOutliner.fromBytes(readFixture(fixture)).unwrap();

      const outline = outliner.outline('René');

      expect(outline.path).toMatch(/^M-?\d+ -?\d+/);
      expect(outline.path).not.toMatch(/\d\.\d/);
      const [x, y, width, height] = outline.viewBox.split(' ').map(Number);
      expect(x).toBe(0);
      expect(y).toBeLessThan(0);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(-y!);
    },
  );

  test('GIVEN a longer text WHEN outlining THEN gets a wider box', () => {
    const outliner = TextOutliner.fromBytes(readFixture('basic.ttf')).unwrap();

    const width = (text: string) =>
      Number(outliner.outline(text).viewBox.split(' ')[2]);

    expect(width('Ada Lovelace')).toBeGreaterThan(width('Ada'));
  });

  test('GIVEN only spaces WHEN outlining THEN has no path but keeps their width', () => {
    const outliner = TextOutliner.fromBytes(readFixture('basic.ttf')).unwrap();

    const outline = outliner.outline('   ');

    expect(outline.path).toBe('');
    expect(Number(outline.viewBox.split(' ')[2])).toBeGreaterThan(0);
  });

  test('GIVEN broken bytes WHEN creating THEN fails', () => {
    expect(
      TextOutliner.fromBytes(new TextEncoder().encode('hello')).isErr(),
    ).toBe(true);
  });
});

import type { TemplateContent } from '@cert-it/shared';
import { describe, expect, test, vi } from 'vite-plus/test';
import { TemplateGlyphChecker } from '../../../../src/template/glyph/TemplateGlyphChecker';
import { readFontFixture } from '../../../font/mocks/readFontFixture';

const Inter = 'a'.repeat(64);
const Inconsolata = 'b'.repeat(64);

const Template: TemplateContent = {
  schemas: [
    [
      {
        name: 'Name',
        type: 'participantName',
        position: { x: 0, y: 0 },
        width: 100,
        height: 10,
        fontName: Inter,
      },
      {
        name: 'Date',
        type: 'issueDate',
        position: { x: 0, y: 20 },
        width: 100,
        height: 10,
        fontName: Inconsolata,
      },
      {
        name: 'Name again',
        type: 'participantName',
        position: { x: 0, y: 40 },
        width: 100,
        height: 10,
        fontName: Inter,
      },
      {
        name: 'QR',
        type: 'qrcode',
        position: { x: 0, y: 60 },
        width: 20,
        height: 20,
      },
    ],
  ],
};

const fixtures: Record<string, string> = {
  [Inter]: 'basic.ttf',
  [Inconsolata]: 'basic.otf',
};

const readFont = vi.fn<(sha256: string) => Promise<Uint8Array>>((sha256) =>
  Promise.resolve(readFontFixture(fixtures[sha256]!)),
);

describe('TemplateGlyphChecker', () => {
  test('GIVEN fields sharing a font WHEN loading THEN reads each font once', async () => {
    readFont.mockClear();

    await TemplateGlyphChecker.load(Template, readFont);

    expect(readFont.mock.calls.map(([sha256]) => sha256)).toEqual([
      Inter,
      Inconsolata,
    ]);
  });

  test('GIVEN values the fonts cover WHEN checking THEN returns nothing', async () => {
    const checker = await TemplateGlyphChecker.load(Template, readFont);

    expect(
      checker.findMissing({
        Name: 'René Smith',
        Date: 'November 20, 2026',
        'Name again': 'René Smith',
      }),
    ).toEqual([]);
  });

  test('GIVEN a name with missing characters WHEN checking THEN lists each field that prints it', async () => {
    const checker = await TemplateGlyphChecker.load(Template, readFont);

    expect(checker.findMissing({ Name: 'Żółć', 'Name again': 'Żółć' })).toEqual(
      [
        {
          field: 'Name',
          type: 'participantName',
          missing: ['Ż', 'ó', 'ł', 'ć'],
        },
        {
          field: 'Name again',
          type: 'participantName',
          missing: ['Ż', 'ó', 'ł', 'ć'],
        },
      ],
    );
  });
});

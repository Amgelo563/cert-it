import type { Result } from 'better-result';
import type { Font } from 'fontkit';
import type { InvalidFontError } from '../font/errors/InvalidFontError';
import { FontReader } from '../font/FontReader';
import type { TextOutline } from './TextOutline';

type TextOutlinerOptions = {
  font: Font;
};

/** Draws text in a font as SVG path data, to preview the font without loading it as a web font. Characters the font lacks are drawn as its missing-glyph box. */
export class TextOutliner {
  /** Longest text it draws, as a preview is one short line. */
  public static readonly MaxLength = 200;

  protected static readonly Decimals = /-?\d+\.\d+/g;

  protected readonly font: Font;

  constructor(options: TextOutlinerOptions) {
    this.font = options.font;
  }

  /** Returns the outliner for the font in the given bytes. */
  public static fromBytes(
    bytes: Uint8Array,
  ): Result<TextOutliner, InvalidFontError> {
    return FontReader.Instance.parse(bytes).map(
      (font) => new TextOutliner({ font }),
    );
  }

  /** Returns the outline of the text, cut to {@link TextOutliner.MaxLength} characters. */
  public outline(text: string): TextOutline {
    const { font } = this;
    const run = font.layout(
      text.normalize('NFC').slice(0, TextOutliner.MaxLength),
    );
    const paths: string[] = [];
    let x = 0;

    run.glyphs.forEach((glyph, index) => {
      const position = run.positions[index]!;
      paths.push(
        glyph.path
          .translate(x + position.xOffset, position.yOffset)
          // fonts point y up, SVG points it down
          .scale(1, -1)
          .toSVG(),
      );
      x += position.xAdvance;
    });

    const height = font.ascent - font.descent;
    return {
      viewBox: `0 ${-font.ascent} ${Math.ceil(x)} ${Math.ceil(height)}`,
      // font units are fine enough without decimals, which halves the size
      path: paths
        .filter(Boolean)
        .join(' ')
        .replace(TextOutliner.Decimals, (value) =>
          String(Math.round(Number(value))),
        ),
    };
  }
}

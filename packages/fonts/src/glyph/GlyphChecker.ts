import type { Result } from 'better-result';
import type { Font } from 'fontkit';
import type { InvalidFontError } from '../font/errors/InvalidFontError';
import { FontReader } from '../font/FontReader';

type GlyphCheckerOptions = {
  font: Font;
};

/** Finds the characters of a text that a font can't draw. */
export class GlyphChecker {
  protected static readonly Whitespace = /\s/u;

  protected readonly font: Font;

  constructor(options: GlyphCheckerOptions) {
    this.font = options.font;
  }

  /** Returns the checker for the font in the given bytes. */
  public static fromBytes(
    bytes: Uint8Array,
  ): Result<GlyphChecker, InvalidFontError> {
    return FontReader.Instance.parse(bytes).map(
      (font) => new GlyphChecker({ font }),
    );
  }

  /** Returns each character the font can't draw, once, in the order they appear. Spaces and line breaks are skipped. */
  public findMissing(text: string): string[] {
    const missing = new Set<string>();

    // NFC joins a letter and a separate accent mark into the single character fonts have
    for (const char of text.normalize('NFC')) {
      if (GlyphChecker.Whitespace.test(char) || missing.has(char)) continue;
      if (!this.font.hasGlyphForCodePoint(char.codePointAt(0)!)) {
        missing.add(char);
      }
    }

    return [...missing];
  }

  /** Returns whether the font can draw every character of the text. */
  public covers(text: string): boolean {
    return this.findMissing(text).length === 0;
  }
}

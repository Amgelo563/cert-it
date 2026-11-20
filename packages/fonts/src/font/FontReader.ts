import { Result } from 'better-result';
import * as fontkit from 'fontkit';
import { InvalidFontError } from './errors/InvalidFontError';
import type { FontInfo } from './FontInfo';
import { InvalidFontReasonEnum } from './InvalidFontReasonEnum';

/** Reads font files and checks they can be used. */
export class FontReader {
  public static readonly Instance = new FontReader();

  // first four bytes of each kind of file, read as text
  protected static readonly OpenTypeSignature = 'OTTO';

  protected static readonly TrueTypeSignatures: ReadonlySet<string> = new Set([
    '\u0000\u0001\u0000\u0000',
    'true',
  ]);

  protected static readonly WebSignatures: ReadonlySet<string> = new Set([
    'wOFF',
    'wOF2',
  ]);

  protected static readonly CollectionSignature = 'ttcf';

  /** Returns the font's details, or why it can't be used. */
  public read(bytes: Uint8Array): Result<FontInfo, InvalidFontError> {
    return this.parse(bytes).map((font) => ({
      family: font.familyName || font.postscriptName,
      style: font.subfamilyName,
      extension:
        this.getSignature(bytes) === FontReader.OpenTypeSignature
          ? 'otf'
          : 'ttf',
      variable: Object.keys(font.variationAxes).length > 0,
    }));
  }

  /** Returns the font parsed by fontkit, for GlyphChecker. */
  public parse(bytes: Uint8Array): Result<fontkit.Font, InvalidFontError> {
    const signature = this.getSignature(bytes);

    if (FontReader.WebSignatures.has(signature)) {
      return Result.err(
        new InvalidFontError({ reason: InvalidFontReasonEnum.WebFormat }),
      );
    }
    if (signature === FontReader.CollectionSignature) {
      return Result.err(
        new InvalidFontError({ reason: InvalidFontReasonEnum.Collection }),
      );
    }
    if (
      signature !== FontReader.OpenTypeSignature
      && !FontReader.TrueTypeSignatures.has(signature)
    ) {
      return Result.err(
        new InvalidFontError({ reason: InvalidFontReasonEnum.Unreadable }),
      );
    }

    try {
      // fontkit reads any Uint8Array, though its types ask for a Buffer
      const font = fontkit.create(bytes as Buffer);
      if ('fonts' in font) {
        return Result.err(
          new InvalidFontError({ reason: InvalidFontReasonEnum.Collection }),
        );
      }

      return Result.ok(font);
    } catch (error) {
      return Result.err(
        new InvalidFontError({
          reason: InvalidFontReasonEnum.Unreadable,
          cause: error instanceof Error ? error : undefined,
        }),
      );
    }
  }

  protected getSignature(bytes: Uint8Array): string {
    return String.fromCharCode(...bytes.subarray(0, 4));
  }
}

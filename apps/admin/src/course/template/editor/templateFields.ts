import type { GlyphChecker } from '@cert-it/fonts';
import { isTemplateTextFieldType } from '@cert-it/shared';
import type { Schema, Template } from '@pdfme/common';

/** A text field whose sample has characters its font can't draw, which would print as blanks. */
export type GlyphWarning = {
  /** Name of the field on the canvas. */
  field: string;
  /** SHA-256 of its font. */
  font: string;
  /** Each missing character, once, in the order they appear. */
  missing: string[];
};

/** Returns whether a field prints text, so it names a font. */
export function isTextField(field: Schema): boolean {
  return isTemplateTextFieldType(field.type);
}

/**
 * Returns the fields with each text field naming its font: pdfme draws a field without one in the fallback font, which the server wants named.
 *
 * @param fallback SHA-256 of the fallback font, or null when none is loaded.
 */
export function withFontNames(
  schemas: Template['schemas'],
  fallback: string | null,
): Template['schemas'] {
  if (!fallback) return schemas;

  return schemas.map((page) =>
    page.map((field) =>
      isTextField(field) && !field['fontName']
        ? { ...field, fontName: fallback }
        : field,
    ),
  );
}

/**
 * Returns the text fields whose text their font can't fully draw.
 *
 * @param inputs Text of each field by its name, such as a participant's; without it, each field's own sample is checked.
 */
export function findGlyphWarnings(
  schemas: Template['schemas'],
  checkers: ReadonlyMap<string, GlyphChecker>,
  inputs?: Readonly<Record<string, string>>,
): GlyphWarning[] {
  return schemas.flat().flatMap((field) => {
    const font = field['fontName'];
    const checker = typeof font === 'string' ? checkers.get(font) : undefined;
    if (!isTextField(field) || !checker || typeof font !== 'string') return [];

    const text = inputs ? inputs[field.name] : field.content;
    const missing = checker.findMissing(String(text ?? ''));
    return missing.length > 0 ? [{ field: field.name, font, missing }] : [];
  });
}

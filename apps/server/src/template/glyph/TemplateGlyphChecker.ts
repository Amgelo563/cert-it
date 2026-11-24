import { GlyphChecker } from '@cert-it/fonts';
import type { TemplateContent, TemplateTextFieldType } from '@cert-it/shared';
import { listTextFields } from '../TemplateTextField';

/** A text field with characters its font can't draw. */
export type MissingGlyphs = {
  /** Name of the field in the template. */
  field: string;
  type: TemplateTextFieldType;
  /** Each missing character, once, in the order they appear. */
  missing: string[];
};

type CheckedField = {
  name: string;
  type: TemplateTextFieldType;
  checker: GlyphChecker;
};

type TemplateGlyphCheckerOptions = {
  fields: readonly CheckedField[];
};

/** Finds the characters of field values that a template's fonts can't draw, which pdfme would print as blanks. */
export class TemplateGlyphChecker {
  protected readonly fields: readonly CheckedField[];

  constructor(options: TemplateGlyphCheckerOptions) {
    this.fields = options.fields;
  }

  /**
   * Loads the fonts of a template's text fields, reading each font once.
   *
   * @throws {Error} If a font can't be read or parsed, as only checked fonts are stored.
   */
  public static async load(
    template: TemplateContent,
    readFont: (sha256: string) => Promise<Uint8Array>,
  ): Promise<TemplateGlyphChecker> {
    const checkers = new Map<string, GlyphChecker>();
    const fields: CheckedField[] = [];

    for (const field of listTextFields(template)) {
      let checker = checkers.get(field.fontName);
      if (!checker) {
        checker = GlyphChecker.fromBytes(
          await readFont(field.fontName),
        ).unwrap();
        checkers.set(field.fontName, checker);
      }
      fields.push({ name: field.name, type: field.type, checker });
    }

    return new TemplateGlyphChecker({ fields });
  }

  /** Returns the fields whose value has characters their font can't draw; empty when every value can be printed. */
  public findMissing(
    values: Readonly<Partial<Record<TemplateTextFieldType, string>>>,
  ): MissingGlyphs[] {
    return this.fields.flatMap(({ name, type, checker }) => {
      const missing = checker.findMissing(values[type] ?? '');
      return missing.length > 0 ? [{ field: name, type, missing }] : [];
    });
  }
}

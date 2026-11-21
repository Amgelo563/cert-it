import type { TemplateFieldType } from './TemplateFieldTypeEnum';

/** What a certificate prints in each kind of field. */
export type TemplateValues = Readonly<Record<TemplateFieldType, string>>;

/** The part of a placed field that binds it to a value. */
type BoundField = {
  readonly name: string;
  readonly type: string;
};

/**
 * Returns the pdfme inputs of one certificate: each field gets the value of its type, so names are free and a type can repeat.
 *
 * @param schemas The template's fields, one list per page.
 */
export function buildTemplateInputs(
  schemas: readonly (readonly BoundField[])[],
  values: TemplateValues,
): Record<string, string>[] {
  const byType: Readonly<Record<string, string>> = values;

  return [
    Object.fromEntries(
      schemas.flat().map((field) => [field.name, byType[field.type] ?? '']),
    ),
  ];
}

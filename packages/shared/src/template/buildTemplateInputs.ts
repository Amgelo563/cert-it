import {
  parseCourseFieldTemplateType,
  type TemplateBuiltInFieldType,
  TemplateFieldTypeEnum,
} from './TemplateFieldTypeEnum';
import type { TemplateFieldValues } from './TemplateFieldValue';

/** What a certificate prints in each kind of field that's the same for every course. */
export type TemplateValues = Readonly<Record<TemplateBuiltInFieldType, string>>;

/** The part of a placed field that binds it to a value. */
type BoundField = {
  readonly name: string;
  readonly type: string;
  readonly [property: string]: unknown;
};

/**
 * Returns the pdfme inputs of one certificate: each field gets the value of its type, so names are free and a type can repeat.
 *
 * Course fields get the value of the field their type names, or nothing when it has none. A boolean prints its template field's trueText or falseText.
 *
 * @param schemas The template's fields, one list per page.
 * @param fields What each course field prints, by field ID.
 */
export function buildTemplateInputs(
  schemas: readonly (readonly BoundField[])[],
  values: TemplateValues,
  fields: TemplateFieldValues = {},
): Record<string, string>[] {
  return [
    Object.fromEntries(
      schemas
        .flat()
        .map((field) => [field.name, inputOf(field, values, fields)]),
    ),
  ];
}

function inputOf(
  field: BoundField,
  values: TemplateValues,
  fields: TemplateFieldValues,
): string {
  const course = parseCourseFieldTemplateType(field.type);
  if (!course) {
    const byType: Readonly<Record<string, string>> = values;
    return byType[field.type] ?? '';
  }

  const value = fields[String(course.fieldId)];
  if (!value) return '';
  if (course.kind === TemplateFieldTypeEnum.FieldImage) {
    return value.kind === 'image' ? value.dataUrl : '';
  }
  switch (value.kind) {
    case 'text':
      return value.text;
    case 'boolean': {
      const wording = value.value ? field['trueText'] : field['falseText'];
      return typeof wording === 'string' ? wording : '';
    }
    case 'image':
      return '';
  }
}

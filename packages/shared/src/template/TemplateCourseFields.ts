import {
  CourseFieldTypeEnum,
  type CourseFieldType,
} from '../field/CourseFieldTypeEnum';
import { formatFieldValue } from '../field/formatFieldValue';
import type { FieldValues } from '../field/FieldValue';
import type { Locale } from '../i18n/LocaleEnum';
import { parseCourseFieldTemplateType } from './TemplateFieldTypeEnum';
import type {
  TemplateFieldValue,
  TemplateFieldValues,
} from './TemplateFieldValue';

type PlacedField = {
  readonly type: string;
  readonly [property: string]: unknown;
};

type FieldsTemplate<F extends PlacedField> = {
  readonly schemas: readonly (readonly F[])[];
};

/** Returns the ID of the course field a template field prints, or null if it prints none. */
export function courseFieldIdOf(field: PlacedField): number | null {
  return parseCourseFieldTemplateType(field.type)?.fieldId ?? null;
}

/** Returns the IDs of the course fields a template prints. */
export function listCourseFieldIds(
  template: FieldsTemplate<PlacedField>,
): Set<number> {
  return new Set(
    template.schemas.flat().flatMap((field) => {
      const id = courseFieldIdOf(field);
      return id === null ? [] : [id];
    }),
  );
}

/** Returns the template without the fields that print the given course field. */
export function withoutCourseField<
  F extends PlacedField,
  T extends FieldsTemplate<F>,
>(template: T, fieldId: number): T {
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.filter((field) => courseFieldIdOf(field) !== fieldId),
    ),
  };
}

type ToTemplateFieldValuesOptions = {
  locale: Locale;
  dateFormat: string;
  /** Returns an image's data: URL, given its stored file name, or undefined when it isn't loaded. */
  imageUrl: (fileName: string) => string | undefined;
};

/** Returns what a participant's values print on a certificate, by field ID. */
export function toTemplateFieldValues(
  fields: readonly { readonly id: number; readonly type: CourseFieldType }[],
  values: FieldValues,
  options: ToTemplateFieldValuesOptions,
): TemplateFieldValues {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = values[String(field.id)];
      if (value === undefined) return [];
      const printed = printedValue(field.type, value, options);
      return printed ? [[String(field.id), printed] as const] : [];
    }),
  );
}

function printedValue(
  type: CourseFieldType,
  value: FieldValues[string],
  options: ToTemplateFieldValuesOptions,
): TemplateFieldValue | null {
  if (type === CourseFieldTypeEnum.Boolean) {
    return typeof value === 'boolean' ? { kind: 'boolean', value } : null;
  }
  if (type === CourseFieldTypeEnum.Image) {
    const dataUrl =
      typeof value === 'string' ? options.imageUrl(value) : undefined;
    return dataUrl ? { kind: 'image', dataUrl } : null;
  }
  const text = formatFieldValue(type, value, options);
  return text === null ? null : { kind: 'text', text };
}

export const TemplateFieldTypeEnum = {
  ParticipantName: 'participantName',
  IssueDate: 'issueDate',
  // must stay qrcode: the pdfme barcode plugin picks its encoder from the type
  QrCode: 'qrcode',
  /** Kind of the fields that print a text, number, date or boolean course field, typed as fieldText:ID. */
  FieldText: 'fieldText',
  /** Kind of the fields that draw an image course field, typed as fieldImage:ID. */
  FieldImage: 'fieldImage',
} as const;

/** The kind of a template field that prints a course field. */
export type TemplateCourseFieldKind =
  | typeof TemplateFieldTypeEnum.FieldText
  | typeof TemplateFieldTypeEnum.FieldImage;

/** The type of a template field that prints a course field: its kind and the field's ID, one type per field. */
export type TemplateCourseFieldType = `${TemplateCourseFieldKind}:${number}`;

/** Field types whose value is the same for every course: the name, issue date and QR code. */
export const TemplateBuiltInFieldTypes = [
  TemplateFieldTypeEnum.ParticipantName,
  TemplateFieldTypeEnum.IssueDate,
  TemplateFieldTypeEnum.QrCode,
] as const;

/** A field type whose value is the same for every course. */
export type TemplateBuiltInFieldType =
  (typeof TemplateBuiltInFieldTypes)[number];

/** A kind of field editors can place on a template. Values are bound to fields by this type, not by their name. */
export type TemplateFieldType =
  | TemplateBuiltInFieldType
  | TemplateCourseFieldType;

/** Built-in field types that print text, so they name a font. */
export const TemplateTextFieldTypes = [
  TemplateFieldTypeEnum.ParticipantName,
  TemplateFieldTypeEnum.IssueDate,
] as const;

/** A field type that prints text, built in or of a course field. */
export type TemplateTextFieldType =
  | (typeof TemplateTextFieldTypes)[number]
  | `${typeof TemplateFieldTypeEnum.FieldText}:${number}`;

const CourseFieldType = /^(fieldText|fieldImage):([1-9]\d*)$/;

/** Returns the type of the template fields that print a course field. */
export function courseFieldTemplateType<Kind extends TemplateCourseFieldKind>(
  kind: Kind,
  fieldId: number,
): `${Kind}:${number}` {
  return `${kind}:${fieldId}`;
}

/** Returns the kind and course field ID of a template field type, or null if it prints no course field. */
export function parseCourseFieldTemplateType(
  type: string,
): { kind: TemplateCourseFieldKind; fieldId: number } | null {
  const match = CourseFieldType.exec(type);
  if (!match) return null;
  return {
    kind: match[1] as TemplateCourseFieldKind,
    fieldId: Number(match[2]),
  };
}

/** Returns whether fields of a type print text, so they name a font. */
export function isTemplateTextFieldType(
  type: string,
): type is TemplateTextFieldType {
  return (
    (TemplateTextFieldTypes as readonly string[]).includes(type)
    || parseCourseFieldTemplateType(type)?.kind
      === TemplateFieldTypeEnum.FieldText
  );
}

export const TemplateFieldTypeEnum = {
  ParticipantName: 'participantName',
  IssueDate: 'issueDate',
  // must stay qrcode: the pdfme barcode plugin picks its encoder from the type
  QrCode: 'qrcode',
} as const;

/** A kind of field editors can place on a template. Values are bound to fields by this type, not by their name. */
export type TemplateFieldType =
  (typeof TemplateFieldTypeEnum)[keyof typeof TemplateFieldTypeEnum];

/** Field types that print text, so they name a font. */
export const TemplateTextFieldTypes = [
  TemplateFieldTypeEnum.ParticipantName,
  TemplateFieldTypeEnum.IssueDate,
] as const;

/** A field type that prints text. */
export type TemplateTextFieldType = (typeof TemplateTextFieldTypes)[number];

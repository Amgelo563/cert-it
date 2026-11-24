import {
  type TemplateContent,
  TemplateFieldTypeEnum,
  type TemplateTextFieldType,
} from '@cert-it/shared';

/** A field of a template that prints text, with the SHA-256 of its font. */
export type TemplateTextField = {
  name: string;
  type: TemplateTextFieldType;
  fontName: string;
};

/** Returns the text fields of a template's page. */
export function listTextFields(template: TemplateContent): TemplateTextField[] {
  return (template.schemas[0] ?? []).flatMap((field) =>
    field.type === TemplateFieldTypeEnum.QrCode
      ? []
      : [{ name: field.name, type: field.type, fontName: field.fontName }],
  );
}

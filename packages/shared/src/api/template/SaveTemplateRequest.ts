import {
  array,
  discriminatedUnion,
  enum as zEnum,
  literal,
  looseObject,
  number,
  type output,
  strictObject,
  string,
} from 'zod';
import {
  TemplateFieldTypeEnum,
  TemplateTextFieldTypes,
} from '../../template/TemplateFieldTypeEnum';

/** Most fields one template takes. */
export const MaxTemplateFields = 50;

/** A hex SHA-256, as base PDFs and fonts are named by. */
export const Sha256Schema = string().regex(/^[0-9a-f]{64}$/);

const FieldBase = {
  name: string().trim().min(1).max(100),
  position: strictObject({ x: number(), y: number() }),
  width: number().positive(),
  height: number().positive(),
};

// loose, so the pdfme properties of each field are kept as the Designer sets them
const TemplateFieldSchema = discriminatedUnion('type', [
  looseObject({
    ...FieldBase,
    type: zEnum(TemplateTextFieldTypes),
    /** SHA-256 of a stored font. Required, so rendering never falls back to a font fetched online. */
    fontName: Sha256Schema,
  }),
  looseObject({ ...FieldBase, type: literal(TemplateFieldTypeEnum.QrCode) }),
]);

export const TemplateContentSchema = looseObject({
  /** The fields of the template's single page. */
  schemas: array(array(TemplateFieldSchema).max(MaxTemplateFields))
    .length(1)
    .refine(
      ([fields = []]) =>
        new Set(fields.map((field) => field.name)).size === fields.length,
      { message: 'Field names must be unique' },
    ),
});

export const SaveTemplateRequestSchema = strictObject({
  /** SHA-256 of a base PDF uploaded to the course. */
  basePdf: Sha256Schema,
  template: TemplateContentSchema,
});

/** One field of a template. */
export type TemplateField = output<typeof TemplateFieldSchema>;

/** A pdfme template without its base PDF, which is stored apart. */
export type TemplateContent = output<typeof TemplateContentSchema>;

/** The body of a request to save a course's template as a new version. */
export type SaveTemplateRequest = output<typeof SaveTemplateRequestSchema>;

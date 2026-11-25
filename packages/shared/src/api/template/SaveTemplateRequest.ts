import {
  array,
  enum as zEnum,
  literal,
  looseObject,
  number,
  type output,
  strictObject,
  string,
  templateLiteral,
  union,
} from 'zod';
import { TemplateFieldTypeEnum } from '../../template/TemplateFieldTypeEnum';

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

/** Most characters a boolean field's wording takes. */
export const MaxBooleanWordingLength = 200;

/** SHA-256 of a stored font. Required, so rendering never falls back to a font fetched online. */
const FontNameSchema = Sha256Schema;

// the course field's ID, as the type names it
const CourseFieldIdSchema = number().int().positive();

// loose, so the pdfme properties of each field are kept as the Designer sets them
const TemplateFieldSchema = union([
  looseObject({
    ...FieldBase,
    type: zEnum([
      TemplateFieldTypeEnum.ParticipantName,
      TemplateFieldTypeEnum.IssueDate,
    ]),
    fontName: FontNameSchema,
  }),
  looseObject({ ...FieldBase, type: literal(TemplateFieldTypeEnum.QrCode) }),
  looseObject({
    ...FieldBase,
    /** Prints the course field whose ID follows the colon. */
    type: templateLiteral([
      TemplateFieldTypeEnum.FieldText,
      ':',
      CourseFieldIdSchema,
    ]),
    fontName: FontNameSchema,
    /** What a boolean field prints when true; nothing if unset. */
    trueText: string().max(MaxBooleanWordingLength).optional(),
    /** What a boolean field prints when false; nothing if unset. */
    falseText: string().max(MaxBooleanWordingLength).optional(),
  }),
  looseObject({
    ...FieldBase,
    /** Draws the course field whose ID follows the colon. */
    type: templateLiteral([
      TemplateFieldTypeEnum.FieldImage,
      ':',
      CourseFieldIdSchema,
    ]),
  }),
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

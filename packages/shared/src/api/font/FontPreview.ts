import { coerce, enum as zEnum, type output, strictObject, string } from 'zod';

/** A line of text drawn in a font, as SVG path data, so the font shows without loading it. */
export type FontPreview = {
  /** SVG `viewBox` the path fits in. */
  readonly viewBox: string;
  /** SVG path data, with y pointing down. */
  readonly path: string;
};

export const CatalogFontPreviewQuerySchema = strictObject({
  /** The family's ID in the catalog. */
  id: string().trim().min(1).max(200),
  weight: coerce.number().int().min(1).max(1000),
  italic: zEnum(['true', 'false']),
  subset: string().trim().min(1).max(50).optional(),
  /** Text to draw, such as a sample name. */
  text: string().min(1).max(100),
});

/** The query of a catalog font preview. */
export type CatalogFontPreviewQuery = output<
  typeof CatalogFontPreviewQuerySchema
>;

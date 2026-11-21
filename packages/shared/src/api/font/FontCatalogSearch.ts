import { type output, strictObject, string } from 'zod';

export const FontCatalogSearchQuerySchema = strictObject({
  /** Part of a family name; empty lists the catalog's first families. */
  search: string().trim().max(100).optional(),
});

/** The query of a font catalog search. */
export type FontCatalogSearchQuery = output<
  typeof FontCatalogSearchQuerySchema
>;

/** One weight and style of a catalog family. */
export type CatalogVariantSummary = {
  /** Such as 400 for regular or 700 for bold. */
  readonly weight: number;
  readonly italic: boolean;
};

/** A family found in the font catalog. */
export type CatalogFamilySummary = {
  /** The catalog's own ID, to send when importing. */
  readonly id: string;
  readonly family: string;
  /** Such as `sans-serif` or `handwriting`. */
  readonly category: string;
  readonly variants: readonly CatalogVariantSummary[];
  /** Scripts it has characters for, such as `latin` or `cyrillic`. */
  readonly subsets: readonly string[];
};

/** The answer to a font catalog search. */
export type FontCatalogSearchResponse = {
  /** Which catalog the site uses, or null when catalog imports are turned off. */
  readonly catalog: string | null;
  readonly families: readonly CatalogFamilySummary[];
};

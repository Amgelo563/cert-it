import { boolean, int, type output, strictObject, string } from 'zod';

export const ImportCatalogFontRequestSchema = strictObject({
  /** The family's ID in the catalog. */
  id: string().trim().min(1).max(200),
  weight: int().min(1).max(1000),
  italic: boolean(),
  /** Script to download, for catalogs that split fonts by script; their default without it. */
  subset: string().trim().min(1).max(50).optional(),
});

/** The body of a request to import a font from the catalog. */
export type ImportCatalogFontRequest = output<
  typeof ImportCatalogFontRequestSchema
>;

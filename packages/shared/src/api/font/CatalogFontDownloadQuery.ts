import type { output } from 'zod';
import { CatalogFontPreviewQuerySchema } from './FontPreview';

export const CatalogFontDownloadQuerySchema =
  CatalogFontPreviewQuerySchema.omit({ text: true });

/** The query of a catalog font downloaded without storing it, such as for practice. */
export type CatalogFontDownloadQuery = output<
  typeof CatalogFontDownloadQuerySchema
>;

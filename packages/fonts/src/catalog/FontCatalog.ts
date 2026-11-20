import type { Result } from 'better-result';
import type { CatalogFamily } from './CatalogFamily';
import type { CatalogVariant } from './CatalogVariant';
import type { CatalogFontNotFoundError } from './errors/CatalogFontNotFoundError';
import type { FontCatalogUnavailableError } from './errors/FontCatalogUnavailableError';
import type { FontTooLargeError } from './errors/FontTooLargeError';

/** An online catalog to search fonts in and download them from. */
export interface FontCatalog {
  /** Returns the families whose name contains the query, ignoring case, in the catalog's order. */
  search(options: {
    query: string;
    category?: string;
    /** @default AbstractFontCatalog.DefaultSearchLimit */
    limit?: number;
  }): Promise<Result<CatalogFamily[], FontCatalogUnavailableError>>;

  /** Downloads the TTF file of one of a family's variants. Catalogs that split fonts by script download the given subset. */
  download(
    id: string,
    variant: CatalogVariant,
    options?: { subset?: string },
  ): Promise<
    Result<
      Uint8Array,
      CatalogFontNotFoundError | FontCatalogUnavailableError | FontTooLargeError
    >
  >;
}

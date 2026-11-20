import type { CatalogVariant } from './CatalogVariant';

/** A family in an online font catalog. */
export type CatalogFamily = {
  /** The catalog's own ID for it, such as `roboto` or `Roboto`. */
  id: string;
  family: string;
  /** Such as `sans-serif` or `handwriting`. */
  category: string;
  variants: CatalogVariant[];
  /** Scripts it has characters for, such as `latin` or `cyrillic`. */
  subsets: string[];
  /** License name, such as `OFL-1.1`, when the catalog says. */
  license: string | null;
};

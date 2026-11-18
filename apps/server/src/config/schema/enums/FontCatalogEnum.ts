export const FontCatalogEnum = {
  Fontsource: 'fontsource',
  Google: 'google',
  None: 'none',
} as const;

/** An online catalog editors can search and import fonts from. */
export type FontCatalog =
  (typeof FontCatalogEnum)[keyof typeof FontCatalogEnum];

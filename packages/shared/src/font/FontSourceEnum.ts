export const FontSourceEnum = {
  Upload: 'upload',
  Catalog: 'catalog',
  Bundled: 'bundled',
} as const;

/** Where a stored font came from. */
export type FontSource = (typeof FontSourceEnum)[keyof typeof FontSourceEnum];

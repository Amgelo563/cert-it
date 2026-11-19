export const FontSourceEnum = {
  Upload: 'upload',
  Catalog: 'catalog',
} as const;

/** Where a stored font came from. */
export type FontSource = (typeof FontSourceEnum)[keyof typeof FontSourceEnum];

/** Options every font catalog takes. */
export type FontCatalogOptions = {
  /** Largest font file it downloads. */
  maxBytes: number;
  /** @default AbstractFontCatalog.DefaultTimeoutMs */
  timeoutMs?: number;
  /** How long the catalog's list of families is kept before downloading it again. @default AbstractFontCatalog.DefaultListTtlMs */
  listTtlMs?: number;
  /** @default globalThis.fetch */
  fetch?: typeof fetch;
  /** @default Date.now */
  now?: () => number;
};

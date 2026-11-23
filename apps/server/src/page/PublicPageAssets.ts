/** The files a public page links, as paths under the base path. */
export type PublicPageAssets = {
  /** Module script, loaded after the page is parsed. */
  readonly script: string;
  readonly styles: readonly string[];
};

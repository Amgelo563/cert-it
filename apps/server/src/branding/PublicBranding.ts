/** The branding a public page links and shows, as URLs under the base path. */
export type PublicBranding = {
  /** Stylesheet with the brand colors and font, linked after the page's own. Null when nothing differs from the built-in theme. */
  readonly stylesheet: string | null;
  readonly favicon: { readonly url: string; readonly type: string };
  /** Logo in the header, in place of the organization's name. Null for the name. */
  readonly logo: string | null;
  /** Logo for the dark color scheme. Null to use the light one. */
  readonly logoDark: string | null;
  /** Image beside the lookup form, in place of the drawn certificate. Null for the drawing. */
  readonly lookupImage: string | null;
};

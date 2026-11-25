/** The branding the server hands the admin panel, from the config's branding section. */
export type AdminBranding = {
  /** Name shown next to the logo and in page titles. */
  readonly name: string;
  /** Ten brand shades, lightest first. */
  readonly brandShades: readonly string[];
  /** URL of the logo, which replaces the built-in mark and name. Null for the built-in one. */
  readonly logo: string | null;
  /** URL of the logo for the dark color scheme. Null to use the light one. */
  readonly logoDark: string | null;
  /** CSS font family of the interface, with its fallbacks. */
  readonly fontFamily: string;
};

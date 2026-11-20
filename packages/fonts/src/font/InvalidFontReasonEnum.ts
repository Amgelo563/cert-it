export const InvalidFontReasonEnum = {
  /** fontkit can't parse it, so it's broken or isn't a font. */
  Unreadable: 'unreadable',
  /** A `.ttc` with several fonts in one file. */
  Collection: 'collection',
  /** WOFF or WOFF2, made for browsers. PDF libraries need the TTF or OTF. */
  WebFormat: 'web_format',
} as const;

/** Why a file can't be used as a font. */
export type InvalidFontReason =
  (typeof InvalidFontReasonEnum)[keyof typeof InvalidFontReasonEnum];

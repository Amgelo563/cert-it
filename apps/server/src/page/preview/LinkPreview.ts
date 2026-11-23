/** What a page shows when its link is shared, written as Open Graph tags. */
export type LinkPreview = {
  /** Absolute URL of the page. */
  readonly url: string;
  readonly siteName: string;
  readonly title: string;
  readonly description: string;
  readonly image: LinkPreviewImage | null;
  /** Shows the image large, below the text, instead of as a thumbnail. */
  readonly largeImage: boolean;
  /** Hex color, such as #0050b4. */
  readonly themeColor: string;
};

export type LinkPreviewImage = {
  /** Absolute URL of the image. */
  readonly url: string;
  /** Media type, when known from the file's extension. */
  readonly type: string | null;
  readonly alt: string | null;
};

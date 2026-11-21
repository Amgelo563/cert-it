/** Returns the URL of a certificate's public page, which its QR code encodes. */
export function certificatePageUrl(code: string): string {
  return new URL(`../c/${encodeURIComponent(code)}`, document.baseURI).href;
}

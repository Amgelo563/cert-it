/** Returns the URL of a certificate's PDF, which the server only serves while it's active. */
export function certificateFileUrl(code: string): string {
  return new URL(`../c/${encodeURIComponent(code)}`, document.baseURI).href;
}

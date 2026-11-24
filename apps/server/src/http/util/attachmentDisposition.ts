// outside printable ASCII, or a quote or backslash, which would end the quoted name
const UnsafeInQuotes = /[^\x20-\x7E]|["\\]/g;

/**
 * Returns a Content-Disposition value that makes the browser save the response under a file name.
 *
 * @param fileName Any text; the plain fallback keeps printable ASCII only, and the full name goes in `filename*`.
 */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(UnsafeInQuotes, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

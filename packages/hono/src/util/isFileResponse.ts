// ranges, downloads and files the proxy sends in place of the empty body
const FileHeaders = [
  'Content-Range',
  'Content-Disposition',
  'X-Accel-Redirect',
  'X-Sendfile',
];

/** Returns whether the response sends a file: with byte ranges, as a download, or through the proxy. */
export function isFileResponse(response: Response): boolean {
  const { headers } = response;

  return (
    headers.get('Accept-Ranges')?.trim().toLowerCase() === 'bytes'
    || FileHeaders.some((header) => headers.has(header))
  );
}

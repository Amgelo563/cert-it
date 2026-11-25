/** The file extension of a field image, by its format. */
export type ImageExtension = 'png' | 'jpg';

const PngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JpegSignature = [0xff, 0xd8, 0xff];

/** Returns the extension of a PNG or JPEG image by its first bytes, or null if it's neither. */
export function imageExtensionOf(bytes: Uint8Array): ImageExtension | null {
  const starts = (signature: readonly number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  if (starts(PngSignature)) return 'png';
  if (starts(JpegSignature)) return 'jpg';
  return null;
}

/** Returns the media type of a stored image, by its file name. */
export function imageMediaTypeOf(fileName: string): string {
  return fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
}

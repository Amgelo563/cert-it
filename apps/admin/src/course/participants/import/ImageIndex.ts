import {
  MaxImageBytes,
  FieldValueErrorEnum,
  type ImportFileErrors,
} from '@cert-it/shared';
import { unzipSync } from 'fflate';

/** The images given with an import, by their file name without folders, lowercased. */
export type ImageIndex = ReadonlyMap<string, readonly File[]>;

/** An image cell matched to its file: the stored name it will have and the file to upload, or why it can't be. */
export type ResolvedImage =
  | { readonly fileName: string; readonly file: File }
  | { readonly error: (typeof ImportFileErrors)[number] };

const ImageName = /\.(png|jpe?g)$/i;

const ZipName = /\.zip$/i;

/** Returns a path's file name, without its folders, lowercased, as image cells are matched. */
export function imageKeyOf(path: string): string {
  return (path.split(/[/\\]/).pop() ?? '').trim().toLowerCase();
}

/**
 * Returns the images of the given files, unpacking ZIP files and leaving out other files.
 *
 * @throws {Error} If a ZIP file can't be read.
 */
export async function indexImages(files: readonly File[]): Promise<ImageIndex> {
  const index = new Map<string, File[]>();
  const add = (file: File) => {
    const key = imageKeyOf(file.name);
    index.set(key, [...(index.get(key) ?? []), file]);
  };

  for (const file of files) {
    if (ImageName.test(file.name)) {
      add(file);
      continue;
    }
    if (!ZipName.test(file.name)) continue;

    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      // macOS adds resource forks and hidden files to its ZIPs
      filter: ({ name }) =>
        ImageName.test(name)
        && !name.startsWith('__MACOSX/')
        && !imageKeyOf(name).startsWith('.'),
    });
    for (const [name, bytes] of Object.entries(entries)) {
      add(
        new File([bytes as Uint8Array<ArrayBuffer>], imageKeyOf(name), {
          type: /\.png$/i.test(name) ? 'image/png' : 'image/jpeg',
        }),
      );
    }
  }
  return index;
}

/** Returns how many images an index has. */
export function countImages(index: ImageIndex): number {
  let count = 0;
  for (const files of index.values()) count += files.length;
  return count;
}

/**
 * Matches an image cell to its file and names it by its hash, as the server stores it.
 *
 * @param hashes Names already worked out, by file, so each file is read once.
 */
export async function resolveImage(
  cell: string,
  index: ImageIndex,
  hashes: Map<File, ResolvedImage>,
): Promise<ResolvedImage> {
  const files = index.get(imageKeyOf(cell)) ?? [];
  if (files.length === 0) return { error: FieldValueErrorEnum.ImageNotFound };
  if (files.length > 1) return { error: FieldValueErrorEnum.ImageAmbiguous };

  const [file] = files as [File];
  const known = hashes.get(file);
  if (known) return known;

  const resolved = await nameImage(file);
  hashes.set(file, resolved);
  return resolved;
}

async function nameImage(file: File): Promise<ResolvedImage> {
  if (file.size > MaxImageBytes) {
    return { error: FieldValueErrorEnum.ImageTooLarge };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = extensionOf(bytes);
  if (!extension) return { error: FieldValueErrorEnum.ImageInvalid };

  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return { fileName: `${sha256}.${extension}`, file };
}

// the same check as the server's, by the first bytes
function extensionOf(bytes: Uint8Array): 'png' | 'jpg' | null {
  const starts = (signature: readonly number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (starts([0xff, 0xd8, 0xff])) return 'jpg';
  return null;
}

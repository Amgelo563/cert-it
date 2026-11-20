import type { FontInfo } from '../../font/FontInfo';

/** A font file saved by FontStore. */
export type StoredFont = FontInfo & {
  /** Hex SHA-256 of the file. */
  sha256: string;
  /** `<sha256>.<ext>`. */
  fileName: string;
};

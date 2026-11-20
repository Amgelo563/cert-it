import type { FontSource } from '../../font/FontSourceEnum';

/** A stored font, as the font routes return it. Its bytes are at `/api/fonts/{sha256}`. */
export type FontSummary = {
  readonly id: number;
  /** Hex SHA-256 of the file, also the name text fields use for it. */
  readonly sha256: string;
  readonly family: string;
  /** Style name, such as `Regular` or `Bold Italic`. */
  readonly style: string;
  readonly source: FontSource;
  /** ISO 8601 date and time. */
  readonly createdAt: string;
};

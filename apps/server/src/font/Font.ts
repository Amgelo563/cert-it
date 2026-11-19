import type { Brand } from '@cert-it/shared';
import type { FontSource } from './FontSourceEnum';

export type FontId = Brand<number, 'FontId'>;

/** A font file stored under the data directory by its content hash. */
export type Font = {
  readonly id: FontId;
  /** Hex SHA-256 of the file's contents. */
  readonly sha256: string;
  readonly family: string;
  /** Style name, such as `Regular` or `Bold Italic`. */
  readonly style: string;
  readonly source: FontSource;
  /** Name of the file under `fonts/`, `<sha256>.<ext>`. */
  readonly fileName: string;
  readonly createdAt: Date;
};

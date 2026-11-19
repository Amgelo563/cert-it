import type { DuplicateModelError, ModelNotFoundError } from '@cert-it/data';
import type { Result } from 'better-result';
import type { Font, FontId } from '../Font';
import type { FontSource } from '../FontSourceEnum';

/** An object that stores and queries fonts. */
export interface FontRepository {
  /** Returns the font with the given ID, or null if there's none. */
  findById(id: FontId): Font | null;

  /** Returns the font with the given content hash, or null if there's none. */
  findBySha256(sha256: string): Font | null;

  /** Creates a font, unless one already has that content hash. */
  create(data: {
    sha256: string;
    family: string;
    style: string;
    source: FontSource;
    fileName: string;
  }): Result<Font, DuplicateModelError>;

  /** Updates the given fields of a font. */
  update(
    id: FontId,
    data: { family?: string; style?: string },
  ): Result<Font, ModelNotFoundError | DuplicateModelError>;

  /**
   * Deletes a font.
   *
   * @throws {Error} If a template version still uses it.
   */
  delete(id: FontId): Result<void, ModelNotFoundError>;

  /** Returns every font, sorted by family and style. */
  list(): Font[];

  /** Returns the fonts that no template version uses. */
  listUnused(): Font[];
}

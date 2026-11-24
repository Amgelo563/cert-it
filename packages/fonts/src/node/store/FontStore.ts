import { createHash } from 'node:crypto';
import { access, rm } from 'node:fs/promises';
import { ManagedDirectory } from '@cert-it/file';
import { FileSystemError } from '@cert-it/shared';
import { Result } from 'better-result';
import type { InvalidFontError } from '../../font/errors/InvalidFontError';
import { FontReader } from '../../font/FontReader';
import type { StoredFont } from './StoredFont';

type FontStoreOptions = {
  /** Folder the files are saved in. */
  directory: ManagedDirectory;
};

/** Saves font files by their SHA-256, so each file is kept once. */
export class FontStore {
  protected static readonly FileNamePattern = /^[0-9a-f]{64}\.(?:ttf|otf)$/;

  protected readonly directory: ManagedDirectory;

  constructor(options: FontStoreOptions) {
    this.directory = options.directory;
  }

  /** Creates a store in the given folder, absolute or relative to the working directory. */
  public static create(options: { directory: string }): FontStore {
    return new FontStore({
      directory: new ManagedDirectory({ root: options.directory }),
    });
  }

  /**
   * Creates the folder if it's missing and removes the temporary files of interrupted saves.
   *
   * @throws {Error} If the folder can't be created or cleaned.
   */
  public start(): void {
    this.directory.start();
  }

  /** Checks the font and saves it, unless a file with the same contents is already there. */
  public async save(
    bytes: Uint8Array,
  ): Promise<Result<StoredFont, InvalidFontError | FileSystemError>> {
    const info = FontReader.Instance.read(bytes);
    if (info.isErr()) return Result.err(info.error);

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const stored: StoredFont = {
      ...info.value,
      sha256,
      fileName: `${sha256}.${info.value.extension}`,
    };

    const path = this.directory.resolve(stored.fileName);
    const exists = await access(path).then(
      () => true,
      () => false,
    );
    if (exists) return Result.ok(stored);

    const written = await this.directory.writeFile(stored.fileName, bytes);
    return written.map(() => stored);
  }

  /**
   * Returns the path of a stored file.
   *
   * @throws {Error} If the name isn't `<sha256>.ttf` or `<sha256>.otf`, so a crafted name can't reach a file outside the folder.
   */
  public getPath(fileName: string): string {
    if (!FontStore.FileNamePattern.test(fileName)) {
      throw new Error(`"${fileName}" is not the name of a stored font.`);
    }

    return this.directory.resolve(fileName);
  }

  /**
   * Deletes a stored file. Deleting a file that's already gone isn't an error.
   *
   * @throws {Error} If the name isn't the name of a stored font.
   */
  public async delete(
    fileName: string,
  ): Promise<Result<void, FileSystemError>> {
    const path = this.getPath(fileName);

    try {
      await rm(path, { force: true });
      return Result.ok(undefined);
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      return Result.err(
        new FileSystemError({ path, message: cause.message, cause }),
      );
    }
  }
}

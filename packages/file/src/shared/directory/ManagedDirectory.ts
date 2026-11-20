import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { FileSystemError } from '@cert-it/shared';
import { Result } from 'better-result';

/** Content {@link ManagedDirectory.writeFile} accepts: text, bytes or a stream of chunks. */
export type FileContent = Parameters<typeof writeFile>[1];

type ManagedDirectoryOptions = {
  /** Path of the directory, absolute or relative to the working directory. */
  root: string;
  /** Folders to create inside it on start. */
  folders?: string[];
};

/** A directory whose files are written atomically, so a crash never leaves a partial file. */
export class ManagedDirectory {
  /** Ends every temporary file, so start() can find the ones a crash left behind. */
  public static readonly TempFileSuffix = '.tmp';

  protected readonly root: string;

  protected readonly folders: string[];

  constructor(options: ManagedDirectoryOptions) {
    this.root = resolve(options.root);
    this.folders = options.folders ?? [];
  }

  /**
   * Creates the directory and its folders, keeping the ones that already exist, and removes the temporary files of interrupted writes.
   *
   * @throws {Error} If a folder can't be created or cleaned, such as when the directory isn't writable.
   */
  public start(): void {
    mkdirSync(this.root, { recursive: true });
    for (const folder of this.folders) {
      mkdirSync(this.resolve(folder), { recursive: true });
    }

    this.removeTempFiles();
  }

  /**
   * Writes a file so that readers see either its old content or the whole new one, never a partial file, even if the process dies mid-write.
   *
   * Creates the file's folder if needed. The content goes to a temporary file in the same folder, which is flushed to disk and then renamed over the target.
   *
   * @throws {Error} If the path is outside the directory.
   */
  public async writeFile(
    path: string,
    content: FileContent,
  ): Promise<Result<void, FileSystemError>> {
    const target = this.resolve(path);
    const temp = `${target}.${randomUUID()}${ManagedDirectory.TempFileSuffix}`;

    try {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(temp, content, { flush: true });
      await rename(temp, target);
      return Result.ok(undefined);
    } catch (error) {
      await rm(temp, { force: true });
      return Result.err(this.toError(target, error));
    }
  }

  /**
   * Returns the absolute path of the given path inside the directory. Absolute paths are accepted when they're inside it.
   *
   * @throws {Error} If the path is outside the directory.
   */
  public resolve(...segments: string[]): string {
    const path = resolve(this.root, ...segments);
    const inside = relative(this.root, path);

    if (inside.startsWith('..') || isAbsolute(inside)) {
      throw new Error(`Path "${path}" is outside "${this.root}".`);
    }

    return path;
  }

  /** Returns the absolute path of the directory. */
  public getRoot(): string {
    return this.root;
  }

  protected removeTempFiles(): void {
    const files = readdirSync(this.root, {
      recursive: true,
      withFileTypes: true,
    });

    for (const file of files) {
      if (
        file.isFile()
        && file.name.endsWith(ManagedDirectory.TempFileSuffix)
      ) {
        rmSync(join(file.parentPath, file.name), { force: true });
      }
    }
  }

  protected toError(path: string, error: unknown): FileSystemError {
    const cause = error instanceof Error ? error : new Error(String(error));
    return new FileSystemError({ path, message: cause.message, cause });
  }
}

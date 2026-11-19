import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { CertificateCode } from '../certificate/code/CertificateCode';
import type { CourseId } from '../course/Course';
import { StartupError } from '../error/StartupError';

/** Content {@link DataDirectoryService.writeFile} accepts: text, bytes or a stream of chunks. */
export type FileContent = Parameters<typeof writeFile>[1];

type DataDirectoryServiceOptions = {
  /** Path of the directory, absolute or relative to the working directory. */
  root: string;
};

/** The directory that holds the database and every stored file: `app.db`, `fonts/`, `templates/` and `certificates/`. */
export class DataDirectoryService {
  protected static readonly DatabaseFileName = 'app.db';

  protected static readonly FontsFolder = 'fonts';

  protected static readonly TemplatesFolder = 'templates';

  protected static readonly CertificatesFolder = 'certificates';

  // ends every temporary file, so start() can find the ones a crash left behind
  protected static readonly TempFileSuffix = '.tmp';

  protected readonly root: string;

  constructor(options: DataDirectoryServiceOptions) {
    this.root = resolve(options.root);
  }

  /**
   * Creates the directory and its folders, keeping the ones that already exist, and removes the temporary files of interrupted writes.
   *
   * @throws {StartupError} If a folder can't be created or cleaned, such as when the directory isn't writable.
   */
  public start(): void {
    const { FontsFolder, TemplatesFolder, CertificatesFolder } =
      DataDirectoryService;

    try {
      for (const folder of [FontsFolder, TemplatesFolder, CertificatesFolder]) {
        const path = join(this.root, folder);
        mkdirSync(path, { recursive: true });
        this.removeTempFiles(path);
      }
    } catch (error) {
      throw new StartupError(
        `Couldn't create the data directory at ${this.root}`,
        { cause: error },
      );
    }
  }

  /**
   * Writes a file so that readers see either its old content or the whole new one, never a partial file, even if the process dies mid-write.
   *
   * Creates the file's folder if needed. The content goes to a temporary file in the same folder, which is flushed to disk and then renamed over the target.
   */
  public async writeFile(path: string, content: FileContent): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${randomUUID()}${DataDirectoryService.TempFileSuffix}`;

    try {
      await writeFile(temp, content, { flush: true });
      await rename(temp, path);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  /** Returns the absolute path of the directory. */
  public getRoot(): string {
    return this.root;
  }

  public getDatabasePath(): string {
    return join(this.root, DataDirectoryService.DatabaseFileName);
  }

  /** Returns the path of a stored font, given its file name (`<sha256>.<ext>`). */
  public getFontPath(fileName: string): string {
    return join(this.root, DataDirectoryService.FontsFolder, fileName);
  }

  /** Returns the path of the base PDF of a course's template version. */
  public getTemplatePath(courseId: CourseId, version: number): string {
    return join(
      this.root,
      DataDirectoryService.TemplatesFolder,
      String(courseId),
      `v${version}.pdf`,
    );
  }

  /** Returns the path of a certificate's PDF. */
  public getCertificatePath(courseId: CourseId, code: CertificateCode): string {
    return join(
      this.root,
      DataDirectoryService.CertificatesFolder,
      String(courseId),
      `${code}.pdf`,
    );
  }

  protected removeTempFiles(folder: string): void {
    const files = readdirSync(folder, { recursive: true, withFileTypes: true });

    for (const file of files) {
      if (
        file.isFile()
        && file.name.endsWith(DataDirectoryService.TempFileSuffix)
      ) {
        rmSync(join(file.parentPath, file.name), { force: true });
      }
    }
  }
}

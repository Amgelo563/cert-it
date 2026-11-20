import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { type FileContent, ManagedDirectory } from '@cert-it/file';
import type { CertificateCode } from '../certificate/code/CertificateCode';
import type { CourseId } from '../course/Course';
import { StartupError } from '../error/StartupError';

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

  protected readonly directory: ManagedDirectory;

  constructor(options: DataDirectoryServiceOptions) {
    const { FontsFolder, TemplatesFolder, CertificatesFolder } =
      DataDirectoryService;

    this.directory = new ManagedDirectory({
      root: options.root,
      folders: [FontsFolder, TemplatesFolder, CertificatesFolder],
    });
  }

  /**
   * Creates the directory and its folders, keeping the ones that already exist, and removes the temporary files of interrupted writes.
   *
   * @throws {StartupError} If a folder can't be created or cleaned, such as when the directory isn't writable.
   */
  public start(): void {
    try {
      this.directory.start();
    } catch (error) {
      throw new StartupError(
        `Couldn't create the data directory at ${this.getRoot()}`,
        { cause: error },
      );
    }
  }

  /**
   * Writes a file so that readers see either its old content or the whole new one, never a partial file, even if the process dies mid-write.
   *
   * @throws {Error} The write's own error, if it fails.
   */
  public async writeFile(path: string, content: FileContent): Promise<void> {
    const result = await this.directory.writeFile(path, content);
    if (result.isErr()) throw result.error.cause;
  }

  /** Returns the absolute path of the directory. */
  public getRoot(): string {
    return this.directory.getRoot();
  }

  public getDatabasePath(): string {
    return this.directory.resolve(DataDirectoryService.DatabaseFileName);
  }

  /** Returns the path of a stored font, given its file name (`<sha256>.<ext>`). */
  public getFontPath(fileName: string): string {
    return this.directory.resolve(DataDirectoryService.FontsFolder, fileName);
  }

  /** Returns the path of the folder fonts are stored in. */
  public getFontsFolder(): string {
    return this.directory.resolve(DataDirectoryService.FontsFolder);
  }

  /** Returns the path of a course's base PDF relative to the directory, given its SHA-256, as template versions store it. */
  public getTemplateFile(courseId: CourseId, sha256: string): string {
    return [
      DataDirectoryService.TemplatesFolder,
      String(courseId),
      `${sha256}.pdf`,
    ].join('/');
  }

  /** Returns the path of a course's base PDF, given its SHA-256. */
  public getTemplatePath(courseId: CourseId, sha256: string): string {
    return this.resolve(this.getTemplateFile(courseId, sha256));
  }

  /**
   * Returns the absolute path of a path inside the directory.
   *
   * @throws {Error} If the path is outside the directory.
   */
  public resolve(path: string): string {
    return this.directory.resolve(path);
  }

  /** Returns a new path for an upload in progress. It ends like a temporary file, so start() removes it if a crash leaves it behind. */
  public createUploadPath(): string {
    return this.directory.resolve(
      DataDirectoryService.TemplatesFolder,
      `${randomUUID()}.upload${ManagedDirectory.TempFileSuffix}`,
    );
  }

  /**
   * Moves a file to a path inside the directory, creating its folder and replacing any file there.
   *
   * @throws {Error} If the move fails, or the target is outside the directory.
   */
  public async moveFile(from: string, to: string): Promise<void> {
    const target = this.directory.resolve(to);
    await mkdir(dirname(target), { recursive: true });
    await rename(from, target);
  }

  /**
   * Deletes a file. Deleting a file that's already gone isn't an error.
   *
   * @throws {Error} If the path is outside the directory, or the file can't be deleted.
   */
  public async deleteFile(path: string): Promise<void> {
    await rm(this.directory.resolve(path), { force: true });
  }

  /** Returns the path of a certificate's PDF. */
  public getCertificatePath(courseId: CourseId, code: CertificateCode): string {
    return this.directory.resolve(
      DataDirectoryService.CertificatesFolder,
      String(courseId),
      `${code}.pdf`,
    );
  }
}

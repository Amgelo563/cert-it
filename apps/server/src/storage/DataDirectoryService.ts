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

  /** Returns the path of the base PDF of a course's template version. */
  public getTemplatePath(courseId: CourseId, version: number): string {
    return this.directory.resolve(
      DataDirectoryService.TemplatesFolder,
      String(courseId),
      `v${version}.pdf`,
    );
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

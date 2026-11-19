import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

  protected readonly root: string;

  constructor(options: DataDirectoryServiceOptions) {
    this.root = resolve(options.root);
  }

  /**
   * Creates the directory and its folders, keeping the ones that already exist.
   *
   * @throws {StartupError} If a folder can't be created, such as when the directory isn't writable.
   */
  public start(): void {
    const { FontsFolder, TemplatesFolder, CertificatesFolder } =
      DataDirectoryService;

    try {
      for (const folder of [FontsFolder, TemplatesFolder, CertificatesFolder]) {
        mkdirSync(join(this.root, folder), { recursive: true });
      }
    } catch (error) {
      throw new StartupError(
        `Couldn't create the data directory at ${this.root}`,
        { cause: error },
      );
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
}

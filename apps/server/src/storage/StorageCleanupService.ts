import { readdir, rm, rmdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { FontStore } from '@cert-it/fonts/node';
import { CourseFieldTypeEnum } from '@cert-it/shared';
import type { DatabaseService } from '../database/DatabaseService';
import type { DataDirectoryService } from './DataDirectoryService';
import type { Clock } from '../clock/Clock';
import type { Logger } from '../log/Logger';
import { SystemClock } from '../clock/SystemClock';
import { ConsoleLogger } from '../log/ConsoleLogger';

type StorageCleanupServiceOptions = {
  database: DatabaseService;
  dataDirectory: DataDirectoryService;
  fontStore: FontStore;
  /** How long a file stays unused before it's deleted. @default StorageCleanupService.DefaultGraceMs */
  graceMs?: number;
  /** @default StorageCleanupService.DefaultIntervalMs */
  intervalMs?: number;
  clock: Clock;
  logger: Logger;
};

/** What one cleanup deleted. */
export type CleanupResult = {
  templateVersions: number;
  fonts: number;
  basePdfs: number;
  images: number;
};

/**
 * Deletes old template versions no certificate uses, then the fonts and base PDFs no template version uses, and the field images no participant has, once they've been unused for a while.
 *
 * Nothing is deleted at once: an editor may have just uploaded a file and not saved the template yet, and a job may still use a version just replaced.
 */
export class StorageCleanupService {
  public static readonly DefaultGraceMs = 24 * 60 * 60 * 1000;

  public static readonly DefaultIntervalMs = 6 * 60 * 60 * 1000;

  protected static readonly PdfExtension = '.pdf';

  protected readonly database: DatabaseService;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly fontStore: FontStore;

  protected readonly graceMs: number;

  protected readonly intervalMs: number;

  protected readonly clock: Clock;

  protected readonly logger: Logger;

  protected timer: NodeJS.Timeout | null = null;

  constructor(options: StorageCleanupServiceOptions) {
    this.database = options.database;
    this.dataDirectory = options.dataDirectory;
    this.fontStore = options.fontStore;
    this.graceMs = options.graceMs ?? StorageCleanupService.DefaultGraceMs;
    this.intervalMs =
      options.intervalMs ?? StorageCleanupService.DefaultIntervalMs;
    this.clock = options.clock;
    this.logger = options.logger;
  }

  public static create(options: {
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    injections?: Partial<
      Omit<StorageCleanupServiceOptions, 'database' | 'dataDirectory'>
    >;
  }): StorageCleanupService {
    const { database, dataDirectory, injections } = options;

    return new StorageCleanupService({
      ...injections,
      database,
      dataDirectory,
      clock: injections?.clock ?? SystemClock.Instance,
      logger: injections?.logger ?? ConsoleLogger.Instance,
      fontStore:
        injections?.fontStore
        ?? FontStore.create({ directory: dataDirectory.getFontsFolder() }),
    });
  }

  /** Cleans up now and then every interval, in the background; a failed run is logged and retried on the next one. */
  public start(): void {
    const runLogged = () => {
      this.run().then(
        ({ templateVersions, fonts, basePdfs, images }) => {
          if (templateVersions + fonts + basePdfs + images > 0) {
            this.logger.info(
              `Deleted ${templateVersions} unused template versions, ${fonts} unused fonts, ${basePdfs} unused base PDFs and ${images} unused images`,
            );
          }
        },
        (error: unknown) =>
          this.logger.error("Couldn't clean up storage:", error),
      );
    };

    runLogged();
    this.timer = setInterval(runLogged, this.intervalMs);
    this.timer.unref();
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Deletes the template versions, fonts, base PDFs and field images that have been unused for longer than the grace period.
   *
   * Versions go first, so the fonts and base PDFs only they used are deleted in the same run.
   *
   * @throws {Error} If a file can't be listed or deleted.
   */
  public async run(): Promise<CleanupResult> {
    const cutoff = this.clock.now().getTime() - this.graceMs;
    return {
      templateVersions: this.deleteTemplateVersions(cutoff),
      fonts: await this.deleteFonts(cutoff),
      basePdfs: await this.deleteBasePdfs(cutoff),
      images: await this.deleteImages(cutoff),
    };
  }

  // a version's links to its fonts go with it; if a certificate started using it meanwhile, its delete fails and it stays
  protected deleteTemplateVersions(cutoff: number): number {
    const { templateVersions } = this.database.getRepositories();
    let deleted = 0;

    for (const version of templateVersions.listUnused(new Date(cutoff))) {
      try {
        if (templateVersions.delete(version.id).isErr()) continue;
      } catch {
        continue;
      }
      deleted += 1;
    }

    return deleted;
  }

  // the row goes first: if a template started using the font meanwhile, its delete fails and the file stays
  protected async deleteFonts(cutoff: number): Promise<number> {
    const { fonts } = this.database.getRepositories();
    let deleted = 0;

    for (const font of fonts.listUnused()) {
      if (font.createdAt.getTime() > cutoff) continue;

      try {
        if (fonts.delete(font.id).isErr()) continue;
      } catch {
        continue;
      }

      const removed = await this.fontStore.delete(font.fileName);
      if (removed.isErr()) throw removed.error;
      deleted += 1;
    }

    return deleted;
  }

  // a base PDF's age is its file's, as uploads keep no row until a version uses them
  protected async deleteBasePdfs(cutoff: number): Promise<number> {
    const used = new Set(
      this.database.getRepositories().templateVersions.listBasePdfPaths(),
    );
    const root = this.dataDirectory.getTemplatesFolder();
    let deleted = 0;

    for (const folder of await readdir(root, { withFileTypes: true })) {
      if (!folder.isDirectory()) continue;

      const path = join(root, folder.name);
      for (const file of await readdir(path, { withFileTypes: true })) {
        if (
          !file.isFile()
          || !file.name.endsWith(StorageCleanupService.PdfExtension)
        ) {
          continue;
        }

        // versions store the path relative to the data directory, with slashes
        const filePath = join(path, file.name);
        const stored = relative(this.dataDirectory.getRoot(), filePath)
          .split(sep)
          .join('/');
        if (used.has(stored) || (await stat(filePath)).mtimeMs > cutoff) {
          continue;
        }

        await rm(filePath, { force: true });
        deleted += 1;
      }

      // a deleted course leaves an empty folder behind
      if ((await readdir(path)).length === 0) await rmdir(path);
    }

    return deleted;
  }

  // an image's age is its file's, as uploads keep no row; a participant may have just been given it
  protected async deleteImages(cutoff: number): Promise<number> {
    const { courseFields, participants } = this.database.getRepositories();
    const imageFields = courseFields.listByType(CourseFieldTypeEnum.Image);
    const used = new Set(
      participants
        .listFieldValues(imageFields.map((field) => field.id))
        .map(({ courseId, value }) => `${courseId}/${String(value)}`),
    );
    const root = this.dataDirectory.getImagesFolder();
    let deleted = 0;

    for (const folder of await readdir(root, { withFileTypes: true })) {
      if (!folder.isDirectory()) continue;

      const path = join(root, folder.name);
      for (const file of await readdir(path, { withFileTypes: true })) {
        if (!file.isFile()) continue;
        const filePath = join(path, file.name);
        if (
          used.has(`${folder.name}/${file.name}`)
          || (await stat(filePath)).mtimeMs > cutoff
        ) {
          continue;
        }

        await rm(filePath, { force: true });
        deleted += 1;
      }

      // a deleted course leaves an empty folder behind
      if ((await readdir(path)).length === 0) await rmdir(path);
    }

    return deleted;
  }
}

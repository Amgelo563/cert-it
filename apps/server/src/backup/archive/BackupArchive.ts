import { readdir, stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { ManagedDirectory } from '@cert-it/file';
import { ZipFile } from 'yazl';

type BackupArchiveOptions = {
  /** Path of the data directory. */
  root: string;
  /** Name of the live database file in the directory, left out with its journal files. */
  databaseFileName: string;
  /** Path of the database snapshot, stored under the database's name. */
  snapshotPath: string;
};

/** A ZIP of the data directory, with a database snapshot in place of the live database file. */
export class BackupArchive {
  // already compressed, so storing them saves CPU for nothing lost
  protected static readonly StoredExtensions: ReadonlySet<string> = new Set([
    '.pdf',
    '.woff',
    '.woff2',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
  ]);

  protected static readonly DatabaseJournalSuffixes = [
    '',
    '-wal',
    '-shm',
    '-journal',
  ];

  protected readonly root: string;

  protected readonly databaseFileName: string;

  protected readonly snapshotPath: string;

  constructor(options: BackupArchiveOptions) {
    this.root = options.root;
    this.databaseFileName = options.databaseFileName;
    this.snapshotPath = options.snapshotPath;
  }

  /**
   * Lists the directory and returns the ZIP as a stream, read from disk as it's consumed.
   *
   * @throws {Error} If the directory or the snapshot can't be read.
   */
  public async open(): Promise<Readable> {
    const zip = new ZipFile();
    const snapshot = await stat(this.snapshotPath);
    zip.addFile(this.snapshotPath, this.databaseFileName, {
      mtime: snapshot.mtime,
    });

    for (const path of await this.listFiles()) {
      const name = relative(this.root, path).split(sep).join('/');
      zip.addFile(path, name, {
        compress: !BackupArchive.StoredExtensions.has(
          extname(path).toLowerCase(),
        ),
      });
    }
    zip.end();

    // yazl types it loosely; it is a PassThrough
    return zip.outputStream as Readable;
  }

  // every file but the live database and the temp files of writes in progress
  protected async listFiles(): Promise<string[]> {
    const excluded = new Set(
      BackupArchive.DatabaseJournalSuffixes.map((suffix) =>
        join(this.root, `${this.databaseFileName}${suffix}`),
      ),
    );
    const entries = await readdir(this.root, {
      recursive: true,
      withFileTypes: true,
    });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name))
      .filter(
        (path) =>
          !excluded.has(path)
          && !path.endsWith(ManagedDirectory.TempFileSuffix),
      )
      .toSorted();
  }
}

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FontStore } from '@cert-it/fonts/node';
import { FontSourceEnum } from '@cert-it/shared';
import type { DatabaseService } from '../database/DatabaseService';
import type { DataDirectoryService } from '../storage/DataDirectoryService';

type FontSeederOptions = {
  database: DatabaseService;
  store: FontStore;
  /** Folder with the font files to add. */
  folder: string;
  fileNames: readonly string[];
};

/** Adds the fonts that come with the server, so every deployment starts with them. */
export class FontSeeder {
  /** Open Sans, under the SIL Open Font License. */
  public static readonly DefaultFiles = [
    'OpenSans-Regular.ttf',
    'OpenSans-Bold.ttf',
  ] as const;

  protected readonly database: DatabaseService;

  protected readonly store: FontStore;

  protected readonly folder: string;

  protected readonly fileNames: readonly string[];

  constructor(options: FontSeederOptions) {
    this.database = options.database;
    this.store = options.store;
    this.folder = options.folder;
    this.fileNames = options.fileNames;
  }

  public static create(options: {
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    injections?: Partial<Pick<FontSeederOptions, 'folder' | 'fileNames'>>;
  }): FontSeeder {
    const { database, dataDirectory, injections } = options;

    return new FontSeeder({
      database,
      store: FontStore.create({ directory: dataDirectory.getFontsFolder() }),
      folder: injections?.folder ?? FontSeeder.defaultFolder(),
      fileNames: injections?.fileNames ?? FontSeeder.DefaultFiles,
    });
  }

  // bundled, every chunk sits flat in dist/
  protected static defaultFolder(): string {
    const relative = import.meta.url.endsWith('.ts')
      ? '../../assets/fonts'
      : '../assets/fonts';
    return fileURLToPath(new URL(relative, import.meta.url));
  }

  /**
   * Stores each font that isn't stored yet. Starting again adds nothing.
   *
   * @throws {Error} If a file is missing, isn't a font, or can't be written.
   */
  public async start(): Promise<void> {
    const { fonts } = this.database.getRepositories();

    for (const fileName of this.fileNames) {
      const bytes = await readFile(`${this.folder}/${fileName}`);
      const saved = await this.store.save(bytes);
      if (saved.isErr()) {
        throw new Error(`Couldn't add the bundled font ${fileName}.`, {
          cause: saved.error,
        });
      }

      const { sha256, family, style, fileName: storedName } = saved.value;
      if (fonts.findBySha256(sha256)) continue;

      fonts
        .create({
          sha256,
          family,
          style,
          source: FontSourceEnum.Bundled,
          fileName: storedName,
        })
        .unwrap();
    }
  }
}

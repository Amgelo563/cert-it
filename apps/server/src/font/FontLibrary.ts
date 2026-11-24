import { InvalidFontError } from '@cert-it/fonts';
import { FontStore } from '@cert-it/fonts/node';
import {
  AuditActionEnum,
  AuditEntityEnum,
  type FontSource,
} from '@cert-it/shared';
import { Result } from 'better-result';
import type { AuditLog } from '../audit/AuditLog';
import type { DatabaseService } from '../database/DatabaseService';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import type { UserId } from '../user/User';
import type { Font } from './Font';

type FontLibraryOptions = {
  database: DatabaseService;
  auditLog: AuditLog;
  store: FontStore;
};

/** The stored fonts: checks and adds new ones, whether uploaded or imported from a catalog. */
export class FontLibrary {
  protected readonly database: DatabaseService;

  protected readonly auditLog: AuditLog;

  protected readonly store: FontStore;

  constructor(options: FontLibraryOptions) {
    this.database = options.database;
    this.auditLog = options.auditLog;
    this.store = options.store;
  }

  public static create(options: {
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    auditLog: AuditLog;
    injections?: Partial<Pick<FontLibraryOptions, 'store'>>;
  }): FontLibrary {
    const { database, dataDirectory, auditLog, injections } = options;

    return new FontLibrary({
      database,
      auditLog,
      store:
        injections?.store
        ?? FontStore.create({ directory: dataDirectory.getFontsFolder() }),
    });
  }

  /**
   * Checks a font and stores it, recording who added it, unless one with the same contents is stored already.
   *
   * @throws {Error} If the file can't be written.
   */
  public async add(
    bytes: Uint8Array,
    source: FontSource,
    userId: UserId,
  ): Promise<Result<{ font: Font; created: boolean }, InvalidFontError>> {
    const saved = await this.store.save(bytes);
    if (saved.isErr()) {
      if (!InvalidFontError.is(saved.error)) throw saved.error;
      return Result.err(saved.error);
    }

    const { fonts } = this.database.getRepositories();
    const existing = fonts.findBySha256(saved.value.sha256);
    if (existing) return Result.ok({ font: existing, created: false });

    const created = this.database.getUnitOfWork().transaction((repositories) =>
      repositories.fonts
        .create({
          sha256: saved.value.sha256,
          family: saved.value.family,
          style: saved.value.style,
          source,
          fileName: saved.value.fileName,
        })
        .map((font) => {
          this.auditLog.record({
            userId,
            action: AuditActionEnum.Create,
            entity: AuditEntityEnum.Font,
            entityId: font.id,
            details: { family: font.family, style: font.style, source },
          });
          return font;
        }),
    );
    // the same font stored twice at once
    if (created.isErr()) {
      const stored = fonts.findBySha256(saved.value.sha256);
      if (!stored) throw created.error;
      return Result.ok({ font: stored, created: false });
    }

    return Result.ok({ font: created.value, created: true });
  }

  /** Returns a stored font with the given SHA-256, or null. */
  public find(sha256: string): Font | null {
    return this.database.getRepositories().fonts.findBySha256(sha256);
  }

  /** Returns every stored font. */
  public list(): Font[] {
    return this.database.getRepositories().fonts.list();
  }

  /**
   * Returns the path of a stored font file.
   *
   * @throws {Error} If the name isn't the name of a stored font.
   */
  public getPath(font: Font): string {
    return this.store.getPath(font.fileName);
  }
}

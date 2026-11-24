import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  SqliteDatabase,
  type SqliteExecutor,
  type UnitOfWork,
} from '@cert-it/data';
import { Result } from 'better-result';
import { SqliteAuditLogRepository } from '../audit/repository/SqliteAuditLogRepository';
import { SqliteSessionRepository } from '../auth/session/repository/SqliteSessionRepository';
import { SqliteCertificateRepository } from '../certificate/repository/SqliteCertificateRepository';
import { SqliteCourseRepository } from '../course/repository/SqliteCourseRepository';
import { StartupError } from '../error/StartupError';
import { SqliteFontRepository } from '../font/repository/SqliteFontRepository';
import { SqliteJobRepository } from '../job/repository/SqliteJobRepository';
import { SqliteParticipantRepository } from '../participant/repository/SqliteParticipantRepository';
import { SqliteTemplateVersionRepository } from '../template/repository/SqliteTemplateVersionRepository';
import { SqliteUserRepository } from '../user/repository/SqliteUserRepository';
import { DatabaseNotStartedError } from './errors/DatabaseNotStartedError';
import type { Repositories } from './Repositories';
import type { DataDirectoryService } from '../storage/DataDirectoryService';

type DatabaseServiceOptions = {
  /** Path of the database file, or `:memory:`. */
  path: string;
  /**
   * Folder with the drizzle-kit migrations.
   *
   * @default the `drizzle/` folder of the nearest parent directory that has one
   */
  migrationsFolder?: string;
  /**
   * Whether start() applies pending migrations. Processes that share the server's database leave them to the server.
   *
   * @default true
   */
  migrate?: boolean;
};

/** An object that owns the app's SQLite database and gives access to its repositories. */
export class DatabaseService {
  protected static readonly MigrationsFolderName = 'drizzle';

  protected readonly path: string;

  protected readonly migrationsFolder: string | null;

  protected readonly migrate: boolean;

  protected database: SqliteDatabase<Repositories> | null = null;

  constructor(options: DatabaseServiceOptions) {
    this.path = options.path;
    this.migrationsFolder = options.migrationsFolder ?? null;
    this.migrate = options.migrate ?? true;
  }

  public static create(options: {
    dataDirectory: DataDirectoryService;
    injections?: Partial<DatabaseServiceOptions>;
  }): DatabaseService {
    const { dataDirectory, injections } = options;

    return new DatabaseService({
      ...injections,
      path: injections?.path ?? dataDirectory.getDatabasePath(),
    });
  }

  /**
   * Opens the database and applies pending migrations, unless `migrate` is false.
   *
   * @throws {StartupError} If the migrations or the file can't be found or opened, or a migration fails or leaves rows pointing at missing rows.
   */
  public start(): void {
    let database: SqliteDatabase<Repositories> | null = null;

    try {
      database = SqliteDatabase.create<Repositories>({
        path: this.path,
        migrationsFolder: this.migrate
          ? (this.migrationsFolder ?? this.findMigrationsFolder())
          : undefined,
        createRepositories: (db) => this.createRepositories(db),
      });
      database.start();
    } catch (error) {
      database?.close();
      throw new StartupError(`Couldn't open the database at ${this.path}`, {
        cause: error,
      });
    }

    this.database = database;
  }

  /** Returns the path of the database file, or `:memory:`. */
  public getPath(): string {
    return this.path;
  }

  /** Closes the database, if it's open. */
  public close(): void {
    this.database?.close();
    this.database = null;
  }

  /**
   * Checks that the database answers a trivial query.
   *
   * @throws {DatabaseNotStartedError} If the database isn't open.
   */
  public ping(): void {
    this.getDatabase().ping();
  }

  /**
   * Returns the repositories, each running its queries outside of any transaction.
   *
   * @throws {DatabaseNotStartedError} If the database isn't open.
   */
  public getRepositories(): Repositories {
    return this.getDatabase().getRepositories();
  }

  /**
   * Returns the object that runs repository operations in one transaction.
   *
   * @throws {DatabaseNotStartedError} If the database isn't open.
   */
  public getUnitOfWork(): UnitOfWork<Repositories> {
    return this.getDatabase().getUnitOfWork();
  }

  /**
   * Runs the work in one transaction, rolling it back if it throws. Writes made through {@link DatabaseService.getRepositories} and other objects on this connection join it, and so does a nested call.
   *
   * @throws {DatabaseNotStartedError} If the database isn't open.
   */
  public atomically<T>(work: () => T): T {
    return this.getUnitOfWork()
      .transaction(() => Result.ok(work()))
      .unwrap();
  }

  /**
   * Returns the connection's executor, for objects that run their own queries outside the repositories. Queries run inside any open transaction.
   *
   * @throws {DatabaseNotStartedError} If the database isn't open.
   */
  public getExecutor(): SqliteExecutor {
    return this.getDatabase().getExecutor();
  }

  protected findMigrationsFolder(): string {
    let directory = import.meta.dirname;

    for (;;) {
      const folder = join(directory, DatabaseService.MigrationsFolderName);
      if (existsSync(join(folder, 'meta', '_journal.json'))) return folder;

      const parent = dirname(directory);
      if (parent === directory) {
        throw new Error(
          `No ${DatabaseService.MigrationsFolderName}/ folder found above ${import.meta.dirname}.`,
        );
      }
      directory = parent;
    }
  }

  protected getDatabase(): SqliteDatabase<Repositories> {
    if (!this.database) throw new DatabaseNotStartedError();
    return this.database;
  }

  protected createRepositories(db: SqliteExecutor): Repositories {
    return {
      users: new SqliteUserRepository({ db }),
      sessions: new SqliteSessionRepository({ db }),
      courses: new SqliteCourseRepository({ db }),
      participants: new SqliteParticipantRepository({ db }),
      fonts: new SqliteFontRepository({ db }),
      templateVersions: new SqliteTemplateVersionRepository({ db }),
      certificates: new SqliteCertificateRepository({ db }),
      jobs: new SqliteJobRepository({ db }),
      auditLog: new SqliteAuditLogRepository({ db }),
    };
  }
}

import BetterSqlite3 from 'better-sqlite3';
import {
  type BetterSQLite3Database,
  drizzle,
} from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { UnitOfWork } from '../../shared/transaction/UnitOfWork';
import { ForeignKeyViolationError } from '../errors/ForeignKeyViolationError';
import type { SqliteRepositoriesFactory } from '../repository/SqliteRepositoriesFactory';
import { SqliteUnitOfWork } from '../transaction/SqliteUnitOfWork';

type SqliteDatabaseOptions<Repositories> = {
  client: BetterSqlite3.Database;
  db: BetterSQLite3Database;
  createRepositories: SqliteRepositoriesFactory<Repositories>;
};

type SqliteDatabaseCreateOptions<Repositories> = {
  /** Path of the database file, or `:memory:`. */
  path: string;
  createRepositories: SqliteRepositoriesFactory<Repositories>;
  /** Folder with the drizzle-kit migrations to apply on open. Without it, no migrations are applied. */
  migrationsFolder?: string;
  /** @default SqliteDatabase.DefaultBusyTimeoutMs */
  busyTimeoutMs?: number;
};

/** An object that owns a SQLite connection and gives access to its repositories. */
export class SqliteDatabase<Repositories> {
  public static readonly DefaultBusyTimeoutMs = 5_000;

  protected readonly client: BetterSqlite3.Database;

  protected readonly db: BetterSQLite3Database;

  protected readonly repositories: Repositories;

  protected readonly unitOfWork: UnitOfWork<Repositories>;

  constructor(options: SqliteDatabaseOptions<Repositories>) {
    this.client = options.client;
    this.db = options.db;
    this.repositories = options.createRepositories(options.db);
    this.unitOfWork = new SqliteUnitOfWork({
      db: options.db,
      createRepositories: options.createRepositories,
    });
  }

  /**
   * Opens the database at the given path, configures it and applies pending migrations.
   *
   * @throws {ForeignKeyViolationError} If the migrations left rows pointing at missing rows. The migrations stay applied.
   */
  public static create<Repositories>(
    options: SqliteDatabaseCreateOptions<Repositories>,
  ): SqliteDatabase<Repositories> {
    const client = new BetterSqlite3(options.path);

    try {
      SqliteDatabase.configure(
        client,
        options.busyTimeoutMs ?? SqliteDatabase.DefaultBusyTimeoutMs,
      );

      const db = drizzle({ client });
      if (options.migrationsFolder) {
        migrate(db, { migrationsFolder: options.migrationsFolder });
        SqliteDatabase.checkForeignKeys(client);
      }

      client.pragma('foreign_keys = ON');

      return new SqliteDatabase({
        client,
        db,
        createRepositories: options.createRepositories,
      });
    } catch (error) {
      client.close();
      throw error;
    }
  }

  protected static configure(
    client: BetterSqlite3.Database,
    busyTimeoutMs: number,
  ): void {
    client.pragma('journal_mode = WAL');
    client.pragma(`busy_timeout = ${busyTimeoutMs}`);
    client.pragma('synchronous = NORMAL');
    // turned on after migrating, see create()
    client.pragma('foreign_keys = OFF');
  }

  protected static checkForeignKeys(client: BetterSqlite3.Database): void {
    const violations = client.pragma('foreign_key_check') as {
      table: string;
      rowid: number | null;
      parent: string;
    }[];

    if (violations.length > 0) {
      throw new ForeignKeyViolationError({
        violations: violations.map(({ table, rowid, parent }) => ({
          table,
          rowid,
          parent,
        })),
      });
    }
  }

  /** Closes the connection. */
  public close(): void {
    this.client.close();
  }

  /** Returns the repositories, each running its queries outside of any transaction. */
  public getRepositories(): Repositories {
    return this.repositories;
  }

  public getUnitOfWork(): UnitOfWork<Repositories> {
    return this.unitOfWork;
  }
}

import BetterSqlite3 from 'better-sqlite3';
import {
  type BetterSQLite3Database,
  drizzle,
} from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { UnitOfWork } from '../../shared/transaction/UnitOfWork';
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

  /** Opens the database at the given path, configures it and applies pending migrations. */
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
      }

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

  protected static configure(
    client: BetterSqlite3.Database,
    busyTimeoutMs: number,
  ): void {
    client.pragma('journal_mode = WAL');
    client.pragma(`busy_timeout = ${busyTimeoutMs}`);
    client.pragma('foreign_keys = ON');
    client.pragma('synchronous = NORMAL');
  }
}

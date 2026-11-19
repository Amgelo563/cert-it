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
  /** Folder with the drizzle-kit migrations that {@link SqliteDatabase.start} applies. Without it, no migrations are applied. */
  migrationsFolder?: string;
  /** @default SqliteDatabase.DefaultBusyTimeoutMs */
  busyTimeoutMs?: number;
};

type SqliteDatabaseCreateOptions<Repositories> = Omit<
  SqliteDatabaseOptions<Repositories>,
  'client' | 'db'
> & {
  /** Path of the database file, or `:memory:`. */
  path: string;
};

/** An object that owns a SQLite connection and gives access to its repositories. */
export class SqliteDatabase<Repositories> {
  public static readonly DefaultBusyTimeoutMs = 5_000;

  protected readonly client: BetterSqlite3.Database;

  protected readonly db: BetterSQLite3Database;

  protected readonly repositories: Repositories;

  protected readonly unitOfWork: UnitOfWork<Repositories>;

  protected readonly migrationsFolder: string | null;

  protected readonly busyTimeoutMs: number;

  constructor(options: SqliteDatabaseOptions<Repositories>) {
    this.client = options.client;
    this.db = options.db;
    this.repositories = options.createRepositories(options.db);
    this.unitOfWork = new SqliteUnitOfWork({
      db: options.db,
      createRepositories: options.createRepositories,
    });
    this.migrationsFolder = options.migrationsFolder ?? null;
    this.busyTimeoutMs =
      options.busyTimeoutMs ?? SqliteDatabase.DefaultBusyTimeoutMs;
  }

  /** Opens a connection to the database at the given path. Call {@link SqliteDatabase.start} before using it. */
  public static create<Repositories>(
    options: SqliteDatabaseCreateOptions<Repositories>,
  ): SqliteDatabase<Repositories> {
    const { path, ...rest } = options;
    const client = new BetterSqlite3(path);

    return new SqliteDatabase({ ...rest, client, db: drizzle({ client }) });
  }

  /**
   * Configures the connection, applies pending migrations and starts enforcing foreign keys.
   *
   * @throws {ForeignKeyViolationError} If the migrations left rows pointing at missing rows. The migrations stay applied.
   */
  public start(): void {
    this.configure();

    if (this.migrationsFolder) {
      migrate(this.db, { migrationsFolder: this.migrationsFolder });
      this.checkForeignKeys();
    }

    this.client.pragma('foreign_keys = ON');
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

  protected configure(): void {
    this.client.pragma('journal_mode = WAL');
    this.client.pragma(`busy_timeout = ${this.busyTimeoutMs}`);
    this.client.pragma('synchronous = NORMAL');
    // turned on after migrating, see start()
    this.client.pragma('foreign_keys = OFF');
  }

  /**
   * Checks that no row points at a missing row, since migrations ran without enforcing foreign keys.
   *
   * @throws {ForeignKeyViolationError} If any row does.
   */
  protected checkForeignKeys(): void {
    const violations = this.client.pragma('foreign_key_check') as {
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
}

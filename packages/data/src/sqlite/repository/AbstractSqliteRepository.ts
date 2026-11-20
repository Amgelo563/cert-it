import { Result } from 'better-result';
import {
  count,
  DrizzleError,
  DrizzleQueryError,
  eq,
  getTableColumns,
  getTableName,
  inArray,
  type InferInsertModel,
  type InferSelectModel,
  type SQL,
} from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { DuplicateModelError } from '../../shared/errors/DuplicateModelError';
import { ModelNotFoundError } from '../../shared/errors/ModelNotFoundError';
import type { Identifiable } from '@cert-it/shared';
import type { ModelId } from '../../shared/model/ModelId';
import type { Page } from '../../shared/page/Page';
import type { PageRequest } from '../../shared/page/PageRequest';
import type { SqliteExecutor } from '../database/SqliteExecutor';

type IdTable = SQLiteTable & { id: SQLiteColumn };

type AbstractSqliteRepositoryOptions = { db: SqliteExecutor };

type FindOptions = {
  where?: SQL;
  /** @default the ID column, ascending */
  orderBy?: (SQLiteColumn | SQL)[];
};

/** A base for repositories of one table with a single `id` primary key, implementing the CRUD operations. */
export abstract class AbstractSqliteRepository<
  Model extends Identifiable,
  Table extends IdTable,
> {
  protected static readonly UniqueViolationCodes: ReadonlySet<string> = new Set(
    ['SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT_PRIMARYKEY'],
  );

  protected static readonly UniqueViolationPrefix =
    'UNIQUE constraint failed: ';

  protected readonly db: SqliteExecutor;

  protected abstract readonly table: Table;

  constructor(options: AbstractSqliteRepositoryOptions) {
    this.db = options.db;
  }

  /** Returns the model with the given ID, or null if there's none. */
  public findById(id: ModelId<Model>): Model | null {
    return this.findOne({ where: eq(this.table.id, id) });
  }

  /** Returns the models with the given IDs, ordered by ID and skipping IDs that don't exist. */
  public findByIds(ids: readonly ModelId<Model>[]): Model[] {
    return this.findMany({ where: inArray(this.table.id, [...ids]) });
  }

  /** Creates a model from the given values. */
  public create(
    values: InferInsertModel<Table>,
  ): Result<Model, DuplicateModelError> {
    try {
      const row = this.db
        .insert(this.table as SQLiteTable)
        .values(values)
        .returning()
        .get();

      return Result.ok(this.toModel(row as InferSelectModel<Table>));
    } catch (error) {
      return Result.err(this.toDuplicateErrorOrThrow(error));
    }
  }

  /** Updates the given fields of a model, leaving the rest unchanged. */
  public update(
    id: ModelId<Model>,
    values: Partial<InferInsertModel<Table>>,
  ): Result<Model, ModelNotFoundError | DuplicateModelError> {
    // drizzle skips undefined values and rejects a set() with nothing left to write
    if (Object.values(values).every((value) => value === undefined)) {
      const found = this.findById(id);
      return found ? Result.ok(found) : Result.err(this.notFound(id));
    }

    try {
      const row = this.db
        .update(this.table as SQLiteTable)
        .set(values)
        .where(eq(this.table.id, id))
        .returning()
        .get();

      return row
        ? Result.ok(this.toModel(row as InferSelectModel<Table>))
        : Result.err(this.notFound(id));
    } catch (error) {
      return Result.err(this.toDuplicateErrorOrThrow(error));
    }
  }

  /** Deletes a model. */
  public delete(id: ModelId<Model>): Result<void, ModelNotFoundError> {
    const { changes } = this.db
      .delete(this.table as SQLiteTable)
      .where(eq(this.table.id, id))
      .run();

    return changes > 0 ? Result.ok(undefined) : Result.err(this.notFound(id));
  }

  /** Returns the first model matching the given filter, or null if there's none. */
  protected findOne(options: FindOptions = {}): Model | null {
    const row = this.select(options).limit(1).get();

    return row ? this.toModel(row as InferSelectModel<Table>) : null;
  }

  /** Returns every model matching the given filter. */
  protected findMany(options: FindOptions = {}): Model[] {
    return this.select(options)
      .all()
      .map((row) => this.toModel(row as InferSelectModel<Table>));
  }

  /** Returns one page of the models matching the given filter. */
  protected findPage(
    request: PageRequest,
    options: FindOptions = {},
  ): Page<Model> {
    const rows = this.select(options)
      .limit(request.size)
      .offset((request.page - 1) * request.size)
      .all();

    return {
      items: rows.map((row) => this.toModel(row as InferSelectModel<Table>)),
      total: this.count(options.where),
      page: request.page,
      size: request.size,
    };
  }

  /** Returns the number of models matching the given filter, or of all models without one. */
  protected count(where?: SQL): number {
    const row = this.db
      .select({ total: count() })
      .from(this.table as SQLiteTable)
      .where(where)
      .get();

    return row?.total ?? 0;
  }

  protected select(options: FindOptions) {
    const { where, orderBy = [this.table.id] } = options;

    return this.db
      .select()
      .from(this.table as SQLiteTable)
      .where(where)
      .orderBy(...orderBy)
      .$dynamic();
  }

  protected notFound(id: ModelId<Model>): ModelNotFoundError {
    return new ModelNotFoundError({ model: getTableName(this.table), id });
  }

  /** Returns a DuplicateModelError for a unique violation, naming the fields by their model keys, or throws any other error. */
  protected toDuplicateErrorOrThrow(error: unknown): DuplicateModelError {
    const columnNames = this.getUniqueViolationColumns(error);
    if (!columnNames) throw error;

    const columns = Object.entries(getTableColumns(this.table));
    const fields = columnNames.map(
      (name) => columns.find(([, column]) => column.name === name)?.[0] ?? name,
    );

    return new DuplicateModelError({ model: getTableName(this.table), fields });
  }

  /** Returns the column names of the unique constraint the given error violated, or null if it isn't a unique violation. */
  protected getUniqueViolationColumns(error: unknown): string[] | null {
    const { UniqueViolationCodes, UniqueViolationPrefix } =
      AbstractSqliteRepository;

    // drizzle wraps driver errors, keeping the driver's error as the cause: query builders throw
    // DrizzleQueryError, raw sql run with db.run() and friends throws DrizzleError
    const driverError =
      error instanceof DrizzleQueryError || error instanceof DrizzleError
        ? error.cause
        : error;
    if (
      !(driverError instanceof Error)
      || !('code' in driverError)
      || typeof driverError.code !== 'string'
      || !UniqueViolationCodes.has(driverError.code)
    ) {
      return null;
    }

    // the message is "UNIQUE constraint failed: <table>.<column>, <table>.<column>"
    const start = driverError.message.indexOf(UniqueViolationPrefix);
    if (start === -1) return null;

    return driverError.message
      .slice(start + UniqueViolationPrefix.length)
      .split(', ')
      .map((qualified) => qualified.slice(qualified.lastIndexOf('.') + 1));
  }

  protected abstract toModel(row: InferSelectModel<Table>): Model;
}

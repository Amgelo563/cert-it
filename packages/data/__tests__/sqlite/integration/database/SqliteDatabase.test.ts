import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { describe, expect, test } from 'vite-plus/test';
import { SqliteDatabase } from '../../../../src/sqlite/database/SqliteDatabase';
import type { SqliteExecutor } from '../../../../src/sqlite/database/SqliteExecutor';
import { ForeignKeyViolationError } from '../../../../src/sqlite/errors/ForeignKeyViolationError';
import { ItemMigrationsFolder } from '../../mocks/createItemDatabase';
import { SqliteItemRepository } from '../../mocks/SqliteItemRepository';

const CascadeMigrationsFolder = join(
  import.meta.dirname,
  '../../mocks/migrations/cascade',
);

function withTempFolder(run: (folder: string) => void): void {
  const folder = mkdtempSync(join(tmpdir(), 'cert-it-data-'));
  try {
    run(folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

function createWithMigrations(
  path: string,
  migrations: 'initial' | 'rebuild' | 'orphan',
): SqliteDatabase<object> {
  return SqliteDatabase.create({
    path,
    migrationsFolder: join(CascadeMigrationsFolder, migrations),
    createRepositories: () => ({}),
  });
}

function startAndClose(database: SqliteDatabase<object>): void {
  try {
    database.start();
  } finally {
    database.close();
  }
}

function countTables(path: string): unknown {
  const client = new BetterSqlite3(path);
  const count = client
    .prepare(`SELECT count(*) FROM sqlite_master WHERE type = 'table'`)
    .pluck()
    .get();
  client.close();

  return count;
}

function insertParentWithChildren(path: string, children: number): void {
  const client = new BetterSqlite3(path);
  client.prepare(`INSERT INTO parents (id, name) VALUES (1, 'parent')`).run();
  for (let i = 0; i < children; i++) {
    client.prepare('INSERT INTO children (parent_id) VALUES (1)').run();
  }
  client.close();
}

function getThrown(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }

  return null;
}

function countChildren(path: string): unknown {
  const client = new BetterSqlite3(path);
  const count = client.prepare('SELECT count(*) FROM children').pluck().get();
  client.close();

  return count;
}

describe('SqliteDatabase (create)', () => {
  test('GIVEN a migrations folder WHEN creating THEN applies nothing until started', () => {
    withTempFolder((folder) => {
      const path = join(folder, 'test.db');
      createWithMigrations(path, 'initial').close();

      expect(countTables(path)).toBe(0);
    });
  });
});

describe('SqliteDatabase (start)', () => {
  test('GIVEN a migrations folder WHEN starting THEN applies the migrations and configures the connection', () => {
    withTempFolder((folder) => {
      const path = join(folder, 'test.db');
      const database = SqliteDatabase.create({
        path,
        migrationsFolder: ItemMigrationsFolder,
        createRepositories: (db) => ({
          items: new SqliteItemRepository({ db }),
        }),
      });
      database.start();

      const created = database
        .getRepositories()
        .items.create({ name: 'A', slug: 'a', groupId: 1, position: 1 });
      database.close();

      const client = new BetterSqlite3(path);
      const journalMode = client.pragma('journal_mode', { simple: true });
      const count = client.prepare('SELECT count(*) FROM items').pluck().get();
      client.close();

      expect(created.isOk()).toBe(true);
      expect(journalMode).toBe('wal');
      expect(count).toBe(1);
    });
  });

  test('GIVEN a migration that rebuilds a parent table WHEN applying it THEN keeps the rows of tables that cascade from it', () => {
    withTempFolder((folder) => {
      const path = join(folder, 'test.db');
      startAndClose(createWithMigrations(path, 'initial'));
      insertParentWithChildren(path, 2);

      startAndClose(createWithMigrations(path, 'rebuild'));

      expect(countChildren(path)).toBe(2);
    });
  });

  test('GIVEN applied migrations WHEN starting THEN enforces foreign keys', () => {
    withTempFolder((folder) => {
      let executor: SqliteExecutor | null = null;
      const database = SqliteDatabase.create({
        path: join(folder, 'test.db'),
        migrationsFolder: join(CascadeMigrationsFolder, 'rebuild'),
        createRepositories: (db) => {
          executor = db;
          return {};
        },
      });
      database.start();

      const thrown = getThrown(() =>
        executor?.run(sql`INSERT INTO children (parent_id) VALUES (999)`),
      );
      database.close();

      // drizzle wraps the driver's error, keeping it as the cause
      expect((thrown as Error | null)?.cause).toMatchObject({
        code: 'SQLITE_CONSTRAINT_FOREIGNKEY',
      });
    });
  });

  test('GIVEN a migration that leaves rows pointing at missing rows WHEN applying it THEN throws a ForeignKeyViolationError', () => {
    withTempFolder((folder) => {
      const path = join(folder, 'test.db');
      startAndClose(createWithMigrations(path, 'initial'));
      insertParentWithChildren(path, 2);

      const thrown = getThrown(() =>
        startAndClose(createWithMigrations(path, 'orphan')),
      );

      expect(ForeignKeyViolationError.is(thrown)).toBe(true);
      expect((thrown as ForeignKeyViolationError).violations).toEqual([
        { table: 'children', rowid: 1, parent: 'parents' },
        { table: 'children', rowid: 2, parent: 'parents' },
      ]);
    });
  });

  test('GIVEN a missing migrations folder WHEN starting THEN throws', () => {
    withTempFolder((folder) => {
      const database = SqliteDatabase.create({
        path: ':memory:',
        migrationsFolder: join(folder, 'missing'),
        createRepositories: () => ({}),
      });

      expect(() => startAndClose(database)).toThrow(/_journal\.json/);
    });
  });
});

describe('SqliteDatabase (ping)', () => {
  test('GIVEN an open database WHEN pinging THEN does not throw', () => {
    const database = SqliteDatabase.create({
      path: ':memory:',
      createRepositories: () => ({}),
    });

    expect(() => database.ping()).not.toThrow();
    database.close();
  });

  test('GIVEN a closed database WHEN pinging THEN throws', () => {
    const database = SqliteDatabase.create({
      path: ':memory:',
      createRepositories: () => ({}),
    });
    database.close();

    expect(() => database.ping()).toThrow(/not open/);
  });
});

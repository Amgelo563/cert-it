import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { describe, expect, test } from 'vite-plus/test';
import { SqliteDatabase } from '../../../../src/sqlite/database/SqliteDatabase';
import { ItemMigrationsFolder } from '../../mocks/createItemDatabase';
import { SqliteItemRepository } from '../../mocks/SqliteItemRepository';

function withTempFolder(run: (folder: string) => void): void {
  const folder = mkdtempSync(join(tmpdir(), 'cert-it-data-'));
  try {
    run(folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

describe('SqliteDatabase (create)', () => {
  test('GIVEN a migrations folder WHEN creating THEN applies the migrations and configures the connection', () => {
    withTempFolder((folder) => {
      const path = join(folder, 'test.db');
      const database = SqliteDatabase.create({
        path,
        migrationsFolder: ItemMigrationsFolder,
        createRepositories: (db) => ({
          items: new SqliteItemRepository({ db }),
        }),
      });

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

  test('GIVEN a missing migrations folder WHEN creating THEN throws', () => {
    withTempFolder((folder) => {
      expect(() =>
        SqliteDatabase.create({
          path: ':memory:',
          migrationsFolder: join(folder, 'missing'),
          createRepositories: () => ({}),
        }),
      ).toThrow(/_journal\.json/);
    });
  });
});

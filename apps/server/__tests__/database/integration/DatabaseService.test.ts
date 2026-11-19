import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { DatabaseNotStartedError } from '../../../src/database/errors/DatabaseNotStartedError';
import { DatabaseService } from '../../../src/database/DatabaseService';
import { StartupError } from '../../../src/error/StartupError';

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cert-it-database-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('DatabaseService (start)', () => {
  test('GIVEN no migrations folder WHEN starting THEN finds the app migrations and creates every table', () => {
    const database = new DatabaseService({ path: join(directory, 'app.db') });

    database.start();

    expect(database.getRepositories().users.count()).toBe(0);
    database.close();
  });

  test('GIVEN a file that is not a database WHEN starting THEN throws a StartupError naming the path', () => {
    const path = join(directory, 'app.db');
    writeFileSync(path, 'not a database');
    const database = new DatabaseService({ path });

    expect(() => database.start()).toThrow(StartupError);
    expect(() => database.start()).toThrow(
      `Couldn't open the database at ${path}: file is not a database`,
    );
  });

  test('GIVEN a missing migrations folder WHEN starting THEN throws a StartupError', () => {
    const database = new DatabaseService({
      path: ':memory:',
      migrationsFolder: join(directory, 'missing'),
    });

    expect(() => database.start()).toThrow(StartupError);
  });
});

describe('DatabaseService (getRepositories)', () => {
  test('GIVEN a database that was not started WHEN getting repositories THEN throws', () => {
    const database = new DatabaseService({ path: ':memory:' });

    expect(() => database.getRepositories()).toThrow(DatabaseNotStartedError);
  });

  test('GIVEN a closed database WHEN getting repositories THEN throws', () => {
    const database = new DatabaseService({ path: ':memory:' });
    database.start();
    database.close();

    expect(() => database.getUnitOfWork()).toThrow(DatabaseNotStartedError);
  });
});

describe('DatabaseService (ping)', () => {
  test('GIVEN a database that was not started WHEN pinging THEN throws a DatabaseNotStartedError', () => {
    const database = new DatabaseService({ path: ':memory:' });

    expect(() => database.ping()).toThrow(DatabaseNotStartedError);
  });
});

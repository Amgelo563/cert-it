import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FontSourceEnum } from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { FontSeeder } from '../../../src/font/FontSeeder';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';

const databases: DatabaseService[] = [];
const roots: string[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const root = mkdtempSync(join(tmpdir(), 'cert-it-seeder-'));
  roots.push(root);
  const dataDirectory = DataDirectoryService.create({ root });
  dataDirectory.start();

  return {
    database,
    dataDirectory,
    seeder: FontSeeder.create({ database, dataDirectory }),
  };
}

describe('FontSeeder (start)', () => {
  test('GIVEN an empty database WHEN starting THEN stores Open Sans Regular and Bold as bundled fonts', async () => {
    const { database, dataDirectory, seeder } = setup();

    await seeder.start();

    const fonts = database.getRepositories().fonts.list();
    expect(
      fonts.map(({ family, style, source }) => [family, style, source]),
    ).toEqual([
      ['Open Sans', 'Bold', FontSourceEnum.Bundled],
      ['Open Sans', 'Regular', FontSourceEnum.Bundled],
    ]);
    for (const font of fonts) {
      expect(existsSync(dataDirectory.getFontPath(font.fileName))).toBe(true);
    }
  });

  test('GIVEN seeded fonts WHEN starting again THEN adds nothing', async () => {
    const { database, seeder } = setup();
    await seeder.start();

    await seeder.start();

    expect(database.getRepositories().fonts.list()).toHaveLength(2);
  });

  test('GIVEN seeded fonts that no template uses WHEN listing unused fonts THEN leaves them out', async () => {
    const { database, seeder } = setup();
    await seeder.start();

    expect(database.getRepositories().fonts.listUnused()).toEqual([]);
  });
});

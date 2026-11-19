import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Repositories } from '../../../../src/database/Repositories';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';

let database: DatabaseService;
let repositories: Repositories;
let seeder: MockSeeder;

beforeEach(() => {
  database = createTestDatabase();
  repositories = database.getRepositories();
  seeder = new MockSeeder(repositories);
});

afterEach(() => {
  database.close();
});

describe('SqliteFontRepository (findBySha256)', () => {
  test('GIVEN a font WHEN finding by its hash THEN returns it', () => {
    const font = seeder.font();

    expect(repositories.fonts.findBySha256(font.sha256)).toEqual(font);
  });

  test('GIVEN a font WHEN creating another with the same hash THEN returns a DuplicateModelError on sha256', () => {
    const { sha256, style, source, fileName } = seeder.font();

    const result = repositories.fonts.create({
      sha256,
      family: 'Other',
      style,
      source,
      fileName,
    });

    expect(result.isErr() && result.error.isOn('sha256')).toBe(true);
  });
});

describe('SqliteFontRepository (listUnused)', () => {
  test('GIVEN fonts used and not used by template versions WHEN listing unused THEN returns only the unused ones', () => {
    const used = seeder.font();
    const unused = seeder.font();
    const templateVersion = seeder.templateVersion(
      seeder.course(),
      seeder.user(),
    );
    repositories.templateVersions.setFontIds(templateVersion.id, [used.id]);

    expect(repositories.fonts.listUnused()).toEqual([unused]);
  });
});

describe('SqliteFontRepository (delete)', () => {
  test('GIVEN a font used by a template version WHEN deleting it THEN throws and keeps it', () => {
    const font = seeder.font();
    const templateVersion = seeder.templateVersion(
      seeder.course(),
      seeder.user(),
    );
    repositories.templateVersions.setFontIds(templateVersion.id, [font.id]);

    expect(() => repositories.fonts.delete(font.id)).toThrow(
      /FOREIGN KEY constraint failed/,
    );
    expect(repositories.fonts.findById(font.id)).toEqual(font);
  });
});

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FontStore } from '@cert-it/fonts/node';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { CourseId } from '../../../src/course/Course';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { StorageCleanupService } from '../../../src/storage/StorageCleanupService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';

const Day = 24 * 60 * 60 * 1000;

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
  const root = mkdtempSync(join(tmpdir(), 'cert-it-cleanup-'));
  roots.push(root);
  const dataDirectory = new DataDirectoryService({ root });
  dataDirectory.start();
  const seeder = new MockSeeder(database.getRepositories());
  const admin = seeder.user();
  // cleans up as if two days had passed, unless told otherwise
  const cleanup = (now = Date.now() + 2 * Day) =>
    new StorageCleanupService({
      database,
      dataDirectory,
      fontStore: new FontStore({ directory: dataDirectory.getFontsFolder() }),
      now: () => now,
      log: () => {},
    }).run();

  // a seeded font, with its file on disk
  const font = () => {
    const stored = seeder.font();
    writeFileSync(join(root, 'fonts', stored.fileName), 'font');
    return stored;
  };

  // a base PDF file of a course, aged the given number of days
  const basePdf = (courseId: number, sha256: string, ageDays = 0) => {
    const path = dataDirectory.getTemplatePath(courseId as CourseId, sha256);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, 'pdf');
    const time = new Date(Date.now() - ageDays * Day);
    utimesSync(path, time, time);
    return path;
  };

  return {
    admin,
    basePdf,
    cleanup,
    database,
    dataDirectory,
    font,
    root,
    seeder,
  };
}

describe('StorageCleanupService (template versions)', () => {
  test('GIVEN an old version replaced long ago WHEN cleaning up THEN deletes it, and then the font only it used', async () => {
    const { admin, cleanup, database, font, seeder } = setup();
    const course = seeder.course();
    const old = seeder.templateVersion(course, admin);
    const latest = seeder.templateVersion(course, admin);
    const repositories = database.getRepositories();
    const oldFont = font();
    repositories.templateVersions.setFontIds(old.id, [oldFont.id]);

    const result = await cleanup();

    expect(result.templateVersions).toBe(1);
    expect(result.fonts).toBe(1);
    expect(repositories.templateVersions.findById(old.id)).toBeNull();
    expect(repositories.templateVersions.findById(latest.id)).not.toBeNull();
    expect(repositories.fonts.findById(oldFont.id)).toBeNull();
  });

  test('GIVEN an old version a certificate uses WHEN cleaning up THEN keeps it', async () => {
    const { admin, cleanup, database, seeder } = setup();
    const course = seeder.course();
    const used = seeder.templateVersion(course, admin);
    seeder.templateVersion(course, admin);
    seeder.certificate(seeder.participant(course), used);

    const result = await cleanup();

    expect(result.templateVersions).toBe(0);
    expect(
      database.getRepositories().templateVersions.findById(used.id),
    ).not.toBeNull();
  });

  test('GIVEN a version replaced just now WHEN cleaning up THEN keeps it, as a job may still use it', async () => {
    const { admin, cleanup, database, seeder } = setup();
    const course = seeder.course();
    const replaced = seeder.templateVersion(course, admin);
    seeder.templateVersion(course, admin);

    const result = await cleanup(Date.now());

    expect(result.templateVersions).toBe(0);
    expect(
      database.getRepositories().templateVersions.findById(replaced.id),
    ).not.toBeNull();
  });
});

describe('StorageCleanupService (fonts)', () => {
  test('GIVEN an unused font older than the grace period WHEN cleaning up THEN deletes its row and file', async () => {
    const { cleanup, database, font, root } = setup();
    const unused = font();

    const result = await cleanup();

    expect(result.fonts).toBe(1);
    expect(database.getRepositories().fonts.findById(unused.id)).toBeNull();
    expect(readdirSync(join(root, 'fonts'))).toEqual([]);
  });

  test('GIVEN a font a template version uses WHEN cleaning up THEN keeps it', async () => {
    const { admin, cleanup, database, font, seeder } = setup();
    const used = font();
    const version = seeder.templateVersion(seeder.course(), admin);
    database
      .getRepositories()
      .templateVersions.setFontIds(version.id, [used.id]);

    const result = await cleanup();

    expect(result.fonts).toBe(0);
    expect(database.getRepositories().fonts.findById(used.id)).not.toBeNull();
  });

  test('GIVEN an unused font added just now WHEN cleaning up THEN keeps it, as an editor may still save it', async () => {
    const { cleanup, database, font } = setup();
    const recent = font();

    const result = await cleanup(Date.now());

    expect(result.fonts).toBe(0);
    expect(database.getRepositories().fonts.findById(recent.id)).not.toBeNull();
  });
});

describe('StorageCleanupService (base PDFs)', () => {
  test('GIVEN base PDFs used, unused and recent WHEN cleaning up THEN deletes only the old unused one', async () => {
    const { admin, basePdf, cleanup, database, dataDirectory, seeder } =
      setup();
    const course = seeder.course();
    const used = basePdf(course.id, 'used', 3);
    database
      .getRepositories()
      .templateVersions.create({
        courseId: course.id,
        version: 1,
        template: { schemas: [[]] },
        basePdfPath: dataDirectory.getTemplateFile(course.id, 'used'),
        createdBy: admin.id,
      })
      .unwrap();
    const unused = basePdf(course.id, 'unused', 3);
    const recent = basePdf(course.id, 'recent', 0);

    const result = await cleanup(Date.now());

    expect(result.basePdfs).toBe(1);
    expect(existsSync(unused)).toBe(false);
    expect(existsSync(recent)).toBe(true);
    expect(existsSync(used)).toBe(true);
  });

  test('GIVEN the base PDFs of a deleted course WHEN cleaning up THEN deletes them and their folder', async () => {
    const { basePdf, cleanup, root } = setup();
    basePdf(99, 'gone', 3);

    const result = await cleanup(Date.now());

    expect(result.basePdfs).toBe(1);
    expect(readdirSync(join(root, 'templates'))).toEqual([]);
  });
});

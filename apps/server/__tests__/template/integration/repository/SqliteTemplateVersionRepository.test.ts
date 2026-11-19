import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Course } from '../../../../src/course/Course';
import type { Repositories } from '../../../../src/database/Repositories';
import type { User } from '../../../../src/user/User';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';

let database: DatabaseService;
let repositories: Repositories;
let seeder: MockSeeder;
let course: Course;
let user: User;

beforeEach(() => {
  database = createTestDatabase();
  repositories = database.getRepositories();
  seeder = new MockSeeder(repositories);
  course = seeder.course();
  user = seeder.user();
});

afterEach(() => {
  database.close();
});

describe('SqliteTemplateVersionRepository (create)', () => {
  test('GIVEN a template WHEN creating a version THEN returns the template as JSON', () => {
    const created = seeder.templateVersion(course, user);

    expect(
      repositories.templateVersions.findById(created.id)?.template,
    ).toEqual({ schemas: [[]] });
  });

  test('GIVEN a version WHEN creating another with the same number in the course THEN returns a DuplicateModelError', () => {
    const existing = seeder.templateVersion(course, user);

    const result = repositories.templateVersions.create({
      courseId: course.id,
      version: existing.version,
      template: { schemas: [] },
      basePdfPath: 'other.pdf',
      createdBy: user.id,
    });

    expect(result.isErr() && result.error.isOn('courseId', 'version')).toBe(
      true,
    );
  });
});

describe('SqliteTemplateVersionRepository (findLatest)', () => {
  test('GIVEN several versions WHEN finding the latest THEN returns the highest version of that course', () => {
    seeder.templateVersion(course, user);
    const latest = seeder.templateVersion(course, user);
    seeder.templateVersion(seeder.course(), user);

    expect(repositories.templateVersions.findLatest(course.id)).toEqual(latest);
  });

  test('GIVEN a course without versions WHEN finding the latest THEN returns null', () => {
    expect(repositories.templateVersions.findLatest(course.id)).toBeNull();
  });
});

describe('SqliteTemplateVersionRepository (listByCourse)', () => {
  test('GIVEN several versions WHEN listing THEN returns the newest first', () => {
    seeder.templateVersion(course, user);
    seeder.templateVersion(course, user);

    expect(
      repositories.templateVersions
        .listByCourse(course.id)
        .map(({ version }) => version),
    ).toEqual([2, 1]);
  });
});

describe('SqliteTemplateVersionRepository (listUnused)', () => {
  test('GIVEN old versions with and without certificates WHEN listing unused THEN returns old ones without certificates', () => {
    const unused = seeder.templateVersion(course, user);
    const used = seeder.templateVersion(course, user);
    seeder.templateVersion(course, user);
    seeder.certificate(seeder.participant(course), used);

    expect(repositories.templateVersions.listUnused(course.id)).toEqual([
      unused,
    ]);
  });

  test('GIVEN only one version without certificates WHEN listing unused THEN keeps it since it is the latest', () => {
    seeder.templateVersion(course, user);

    expect(repositories.templateVersions.listUnused(course.id)).toEqual([]);
  });
});

describe('SqliteTemplateVersionRepository (setFontIds)', () => {
  test('GIVEN fonts WHEN setting them twice THEN replaces the first ones and ignores repeats', () => {
    const [a, b, c] = [seeder.font(), seeder.font(), seeder.font()];
    const templateVersion = seeder.templateVersion(course, user);

    repositories.templateVersions.setFontIds(templateVersion.id, [a.id, b.id]);
    repositories.templateVersions.setFontIds(templateVersion.id, [
      c.id,
      b.id,
      c.id,
    ]);

    expect(
      repositories.templateVersions.listFontIds(templateVersion.id),
    ).toEqual([b.id, c.id]);
  });

  test('GIVEN fonts WHEN setting an empty list THEN removes them', () => {
    const templateVersion = seeder.templateVersion(course, user);
    repositories.templateVersions.setFontIds(templateVersion.id, [
      seeder.font().id,
    ]);

    repositories.templateVersions.setFontIds(templateVersion.id, []);

    expect(
      repositories.templateVersions.listFontIds(templateVersion.id),
    ).toEqual([]);
  });
});

describe('SqliteTemplateVersionRepository (delete)', () => {
  test('GIVEN a version used by a certificate WHEN deleting it THEN throws', () => {
    const templateVersion = seeder.templateVersion(course, user);
    seeder.certificate(seeder.participant(course), templateVersion);

    expect(() =>
      repositories.templateVersions.delete(templateVersion.id),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  test('GIVEN a version with fonts WHEN deleting it THEN frees its fonts', () => {
    const font = seeder.font();
    const templateVersion = seeder.templateVersion(course, user);
    repositories.templateVersions.setFontIds(templateVersion.id, [font.id]);

    repositories.templateVersions.delete(templateVersion.id).unwrap();

    expect(repositories.fonts.listUnused()).toEqual([font]);
  });
});

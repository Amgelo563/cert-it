import type { SqliteDatabase } from '@cert-it/data';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Repositories } from '../../../../src/database/Repositories';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';

let database: SqliteDatabase<Repositories>;
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

describe('SqliteCourseRepository (list)', () => {
  test('GIVEN several courses WHEN listing THEN returns the newest first', () => {
    const first = seeder.course();
    const second = seeder.course();

    const page = repositories.courses.list({ page: 1, size: 10 });

    expect(page.items.map((course) => course.id)).toEqual([
      second.id,
      first.id,
    ]);
  });
});

describe('SqliteCourseRepository (listForLookup)', () => {
  test('GIVEN courses with lookup on and off WHEN listing for lookup THEN returns only active ones with lookup on, by name', () => {
    seeder.course({ name: 'B' });
    seeder.course({ name: 'A' });
    seeder.course({ name: 'Hidden', lookupEnabled: false });
    seeder.course({ name: 'Archived', active: false });

    expect(
      repositories.courses.listForLookup().map((course) => course.name),
    ).toEqual(['A', 'B']);
  });
});

describe('SqliteCourseRepository (delete)', () => {
  test('GIVEN a course with participants, templates, certificates and jobs WHEN deleting it THEN deletes all of them', () => {
    const user = seeder.user();
    const course = seeder.course();
    const participant = seeder.participant(course);
    const templateVersion = seeder.templateVersion(course, user);
    const certificate = seeder.certificate(participant, templateVersion);

    expect(repositories.courses.delete(course.id).isOk()).toBe(true);
    expect(repositories.participants.findById(participant.id)).toBeNull();
    expect(
      repositories.templateVersions.findById(templateVersion.id),
    ).toBeNull();
    expect(repositories.certificates.findById(certificate.id)).toBeNull();
  });
});

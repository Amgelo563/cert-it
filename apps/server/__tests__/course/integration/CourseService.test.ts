import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  type ApiPage,
  AuditActionEnum,
  AuditEntityEnum,
  type AuditEntrySummary,
  CertificateStatusEnum,
  type CourseSummary,
  LocaleEnum,
  RoleEnum,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { CourseId } from '../../../src/course/Course';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createApiHarness } from '../../http/mocks/createApiHarness';
import { TestDataDirectories } from '../../storage/mocks/TestDataDirectories';

const databases: DatabaseService[] = [];

const directories = new TestDataDirectories();

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  directories.removeAll();
});

// an Admin logged in through the API, ready to manage courses
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const dataDirectory = directories.create();
  const harness = createApiHarness(database, { dataDirectory });
  const admin = await harness.loginAs({
    email: 'admin@example.org',
    role: RoleEnum.Admin,
  });
  const courses = (method: string, path: string, body?: unknown) =>
    harness.request(method, `/courses${path}`, { cookie: admin.cookie, body });
  const seeder = new MockSeeder(database.getRepositories());
  const auditEntries = () =>
    database
      .getRepositories()
      .auditLog.list({ page: 1, size: 50 })
      .items.filter((entry) => entry.entity === AuditEntityEnum.Course);

  return {
    ...harness,
    admin,
    auditEntries,
    courses,
    database,
    dataDirectory,
    seeder,
  };
}

describe('CourseService (list)', () => {
  test('GIVEN courses with participants and certificates WHEN listing THEN answers their counts', async () => {
    const { admin, courses, database, seeder } = await setup();
    const course = seeder.course({ name: 'Networks' });
    seeder.course({ name: 'Empty' });
    const version = seeder.templateVersion(course, admin.user);
    const certificates = [1, 2, 3].map(() =>
      seeder.certificate(seeder.participant(course), version),
    );
    seeder.participant(course);
    database
      .getRepositories()
      .certificates.update(certificates[0]!.id, {
        status: CertificateStatusEnum.Revoked,
      })
      .unwrap();

    const response = await courses('GET', '');
    const page = (await response.json()) as ApiPage<CourseSummary>;

    expect(response.status).toBe(200);
    expect(page.total).toBe(2);
    expect(page.items.find((item) => item.name === 'Networks')).toEqual({
      id: course.id,
      name: 'Networks',
      locale: LocaleEnum.En,
      dateFormat: 'MMMM D, YYYY',
      lookupEnabled: true,
      active: true,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      participantCount: 4,
      latestTemplateVersion: 1,
      certificateCounts: { active: 2, revoked: 1 },
    });
    expect(page.items.find((item) => item.name === 'Empty')).toMatchObject({
      participantCount: 0,
      latestTemplateVersion: null,
      certificateCounts: { active: 0, revoked: 0 },
    });
  });

  test('GIVEN a Viewer WHEN listing courses THEN answers 200', async () => {
    const { loginAs, request } = await setup();
    const { cookie } = await loginAs({
      email: 'viewer@example.org',
      role: RoleEnum.Viewer,
    });

    expect((await request('GET', '/courses', { cookie })).status).toBe(200);
  });
});

describe('CourseService (get)', () => {
  test('GIVEN a course WHEN getting it THEN answers its summary', async () => {
    const { courses, seeder } = await setup();
    const course = seeder.course({ name: 'Networks' });

    const response = await courses('GET', `/${course.id}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: course.id,
      name: 'Networks',
    });
  });

  test.each(['999', 'abc', '0'])(
    'GIVEN the id %s WHEN getting a course THEN answers 404',
    async (id) => {
      const { courses } = await setup();

      expect((await courses('GET', `/${id}`)).status).toBe(404);
    },
  );
});

describe('CourseService (add)', () => {
  test('GIVEN only a name WHEN adding a course THEN uses the default locale and its date format', async () => {
    const { auditEntries, courses } = await setup();

    const response = await courses('POST', '', { name: '  Networks  ' });
    const course = (await response.json()) as CourseSummary;

    expect(response.status).toBe(201);
    expect(course).toMatchObject({
      name: 'Networks',
      locale: LocaleEnum.En,
      dateFormat: 'MMMM D, YYYY',
      lookupEnabled: true,
      active: true,
      participantCount: 0,
    });
    expect(auditEntries()).toMatchObject([
      {
        action: AuditActionEnum.Create,
        entityId: course.id,
        details: { name: 'Networks' },
      },
    ]);
  });

  test("GIVEN a locale but no date format WHEN adding a course THEN uses that locale's format", async () => {
    const { courses } = await setup();

    const response = await courses('POST', '', {
      name: 'Redes',
      locale: LocaleEnum.Es,
      lookupEnabled: false,
    });

    expect(await response.json()).toMatchObject({
      locale: LocaleEnum.Es,
      dateFormat: 'D [de] MMMM [de] YYYY',
      lookupEnabled: false,
    });
  });

  test.each([
    { name: '' },
    { name: '   ' },
    { name: 'x'.repeat(201) },
    { name: 'Networks', locale: 'fr' },
    { name: 'Networks', dateFormat: '' },
    { name: 'Networks', active: false },
  ])(
    'GIVEN the body %o WHEN adding a course THEN answers 400',
    async (body) => {
      const { courses } = await setup();

      expect((await courses('POST', '', body)).status).toBe(400);
    },
  );
});

describe('CourseService (body limit)', () => {
  test('GIVEN a body over 16 KB WHEN adding a course THEN answers 413', async () => {
    const { courses } = await setup();

    const response = await courses('POST', '', {
      name: 'Networks',
      padding: 'x'.repeat(20 * 1024),
    });

    expect(response.status).toBe(413);
  });
});

describe('CourseService (update)', () => {
  test('GIVEN new fields WHEN updating a course THEN changes and audits only those', async () => {
    const { auditEntries, courses, seeder } = await setup();
    const course = seeder.course({ name: 'Networks' });

    const response = await courses('PATCH', `/${course.id}`, {
      dateFormat: 'D/M/YYYY',
      lookupEnabled: false,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: 'Networks',
      dateFormat: 'D/M/YYYY',
      lookupEnabled: false,
    });
    expect(auditEntries()).toMatchObject([
      {
        action: AuditActionEnum.Update,
        details: { dateFormat: 'D/M/YYYY', lookupEnabled: false },
      },
    ]);
  });

  test('GIVEN an empty body WHEN updating a course THEN answers 400', async () => {
    const { courses, seeder } = await setup();
    const course = seeder.course();

    expect((await courses('PATCH', `/${course.id}`, {})).status).toBe(400);
  });

  test('GIVEN a missing course WHEN updating it THEN answers 404', async () => {
    const { courses } = await setup();

    expect((await courses('PATCH', '/999', { name: 'X' })).status).toBe(404);
  });
});

describe('CourseService (delete)', () => {
  test('GIVEN a course with participants WHEN an Admin deletes it THEN removes both and keeps its name in the audit log', async () => {
    const { admin, courses, database, request, seeder } = await setup();
    const course = seeder.course({ name: 'Networks' });
    const participant = seeder.participant(course);

    const response = await courses('DELETE', `/${course.id}`);
    const audit = await request('GET', '/audit', { cookie: admin.cookie });
    const entries = (await audit.json()) as ApiPage<AuditEntrySummary>;
    const { courses: courseRepository, participants } =
      database.getRepositories();

    expect(response.status).toBe(204);
    expect(courseRepository.findById(course.id)).toBeNull();
    expect(participants.findById(participant.id)).toBeNull();
    expect(
      entries.items.find((entry) => entry.action === AuditActionEnum.Delete),
    ).toMatchObject({
      entity: AuditEntityEnum.Course,
      entityName: 'Networks',
    });
  });

  test('GIVEN two courses with PDFs WHEN deleting one THEN removes only its PDFs', async () => {
    const { admin, courses, dataDirectory, seeder } = await setup();
    const course = seeder.course();
    const [deleted, kept] = [course, seeder.course()].map((target) => {
      const certificate = seeder.certificate(
        seeder.participant(target),
        seeder.templateVersion(target, admin.user),
      );
      return directories.writePdf(dataDirectory, certificate);
    });

    const response = await courses('DELETE', `/${course.id}`);

    expect(response.status).toBe(204);
    expect(existsSync(deleted!)).toBe(false);
    expect(existsSync(dirname(deleted!))).toBe(false);
    expect(existsSync(kept!)).toBe(true);
  });

  test('GIVEN an Editor WHEN deleting a course THEN answers 403 and keeps it', async () => {
    const { database, loginAs, request, seeder } = await setup();
    const course = seeder.course();
    const { cookie } = await loginAs({ email: 'editor@example.org' });

    const response = await request('DELETE', `/courses/${course.id}`, {
      cookie,
    });

    expect(response.status).toBe(403);
    expect(
      database.getRepositories().courses.findById(course.id as CourseId),
    ).not.toBeNull();
  });

  test('GIVEN a missing course WHEN deleting it THEN answers 404', async () => {
    const { courses } = await setup();

    expect((await courses('DELETE', '/999')).status).toBe(404);
  });
});

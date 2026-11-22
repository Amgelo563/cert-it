import {
  type ApiPage,
  AuditActionEnum,
  AuditEntityEnum,
  type AuditEntrySummary,
  type ParticipantSummary,
  RoleEnum,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createApiHarness } from '../../http/mocks/createApiHarness';

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

// an Admin logged in through the API, with a course to add participants to
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const harness = createApiHarness(database);
  const admin = await harness.loginAs({
    email: 'admin@example.org',
    role: RoleEnum.Admin,
  });
  const seeder = new MockSeeder(database.getRepositories());
  const course = seeder.course({ name: 'Networks' });
  const participants = (
    method: string,
    path: string,
    body?: unknown,
    courseId: number = course.id,
  ) =>
    harness.request(method, `/courses/${courseId}/participants${path}`, {
      cookie: admin.cookie,
      body,
    });
  const auditEntries = () =>
    database
      .getRepositories()
      .auditLog.list({ page: 1, size: 50 })
      .items.filter((entry) => entry.entity === AuditEntityEnum.Participant);

  return { ...harness, admin, auditEntries, course, participants, seeder };
}

describe('ParticipantService (list)', () => {
  test('GIVEN participants in two courses WHEN listing one THEN answers only its own, by name', async () => {
    const { course, participants, seeder } = await setup();
    seeder.participant(course, { name: 'Bob', email: 'bob@example.org' });
    seeder.participant(course, { name: 'Ada' });
    seeder.participant(seeder.course(), { name: 'Other' });

    const response = await participants('GET', '');
    const page = (await response.json()) as ApiPage<ParticipantSummary>;

    expect(response.status).toBe(200);
    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.name)).toEqual(['Ada', 'Bob']);
    expect(page.items[1]).toEqual({
      id: expect.any(Number),
      courseId: course.id,
      name: 'Bob',
      email: 'bob@example.org',
      extra: {},
      certificate: null,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  test('GIVEN certificates on two template versions WHEN listing THEN answers each one with its version', async () => {
    const { admin, course, participants, seeder } = await setup();
    const first = seeder.templateVersion(course, admin.user);
    const ada = seeder.participant(course, { name: 'Ada' });
    const certificate = seeder.certificate(ada, first);
    const second = seeder.templateVersion(course, admin.user);
    seeder.certificate(seeder.participant(course, { name: 'Bob' }), second);
    seeder.participant(course, { name: 'Carol' });

    const response = await participants('GET', '');
    const page = (await response.json()) as ApiPage<ParticipantSummary>;

    expect(page.items.map((item) => item.certificate)).toEqual([
      {
        id: certificate.id,
        code: certificate.code,
        status: 'active',
        templateVersion: 1,
        issueDate: certificate.issueDate,
        revokedReason: null,
      },
      expect.objectContaining({ templateVersion: 2 }),
      null,
    ]);
  });

  test('GIVEN a search WHEN listing THEN answers the matches', async () => {
    const { course, participants, seeder } = await setup();
    seeder.participant(course, { name: 'Ada', email: 'ada@uni.edu' });
    seeder.participant(course, { name: 'Bob', email: 'bob@example.org' });

    const response = await participants('GET', '?search=uni.edu');
    const page = (await response.json()) as ApiPage<ParticipantSummary>;

    expect(page.items.map((item) => item.name)).toEqual(['Ada']);
  });

  test('GIVEN a certificate filter WHEN listing THEN answers only participants in that state', async () => {
    const { admin, course, participants, seeder } = await setup();
    const version = seeder.templateVersion(course, admin.user);
    seeder.certificate(seeder.participant(course, { name: 'Ada' }), version);
    seeder.participant(course, { name: 'Bob' });

    const response = await participants('GET', '?certificate=none');
    const page = (await response.json()) as ApiPage<ParticipantSummary>;

    expect(page.items.map((item) => item.name)).toEqual(['Bob']);
  });

  test('GIVEN an unknown certificate filter WHEN listing THEN answers 400', async () => {
    const { participants } = await setup();

    expect((await participants('GET', '?certificate=lost')).status).toBe(400);
  });

  test('GIVEN a missing course WHEN listing THEN answers 404', async () => {
    const { participants } = await setup();

    expect((await participants('GET', '', undefined, 999)).status).toBe(404);
  });
});

describe('ParticipantService (add)', () => {
  test('GIVEN a name and email WHEN adding THEN stores the email normalized and audits it', async () => {
    const { auditEntries, participants } = await setup();

    const response = await participants('POST', '', {
      name: '  Ada Lovelace ',
      email: ' Ada@Example.ORG ',
    });
    const participant = (await response.json()) as ParticipantSummary;

    expect(response.status).toBe(201);
    expect(participant).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.org',
    });
    expect(auditEntries()).toMatchObject([
      {
        action: AuditActionEnum.Create,
        entityId: participant.id,
        details: { email: 'ada@example.org' },
      },
    ]);
  });

  test('GIVEN an email already in the course, in another case WHEN adding THEN answers 409', async () => {
    const { course, participants, seeder } = await setup();
    seeder.participant(course, { email: 'ada@example.org' });

    const response = await participants('POST', '', {
      name: 'Ada',
      email: 'ADA@example.org',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'participant_email_taken',
    });
  });

  test('GIVEN an email used in another course WHEN adding THEN answers 201', async () => {
    const { participants, seeder } = await setup();
    seeder.participant(seeder.course(), { email: 'ada@example.org' });

    const response = await participants('POST', '', {
      name: 'Ada',
      email: 'ada@example.org',
    });

    expect(response.status).toBe(201);
  });

  test.each([
    { name: '', email: 'ada@example.org' },
    { name: 'Ada', email: 'not-an-email' },
    { name: 'Ada' },
    { name: 'Ada', email: 'ada@example.org', extra: {} },
  ])('GIVEN the body %o WHEN adding THEN answers 400', async (body) => {
    const { participants } = await setup();

    expect((await participants('POST', '', body)).status).toBe(400);
  });
});

describe('ParticipantService (update)', () => {
  test('GIVEN a new email WHEN updating THEN changes it and audits only it', async () => {
    const { auditEntries, course, participants, seeder } = await setup();
    const participant = seeder.participant(course, { name: 'Ada' });

    const response = await participants('PATCH', `/${participant.id}`, {
      email: 'New@Example.org',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: 'Ada',
      email: 'new@example.org',
    });
    expect(auditEntries()).toMatchObject([
      {
        action: AuditActionEnum.Update,
        details: { email: 'new@example.org' },
      },
    ]);
  });

  test("GIVEN another participant's email WHEN updating THEN answers 409", async () => {
    const { course, participants, seeder } = await setup();
    seeder.participant(course, { email: 'taken@example.org' });
    const participant = seeder.participant(course);

    const response = await participants('PATCH', `/${participant.id}`, {
      email: 'taken@example.org',
    });

    expect(response.status).toBe(409);
  });

  test('GIVEN a participant of another course WHEN updating it under this one THEN answers 404', async () => {
    const { participants, seeder } = await setup();
    const other = seeder.participant(seeder.course());

    const response = await participants('PATCH', `/${other.id}`, {
      name: 'X',
    });

    expect(response.status).toBe(404);
  });
});

describe('ParticipantService (delete)', () => {
  test('GIVEN a participant WHEN an Admin deletes them THEN removes them and keeps their name in the audit log', async () => {
    const { admin, course, participants, request, seeder } = await setup();
    const participant = seeder.participant(course, { name: 'Ada' });

    const response = await participants('DELETE', `/${participant.id}`);
    const list = (await (
      await participants('GET', '')
    ).json()) as ApiPage<ParticipantSummary>;
    const audit = (await (
      await request('GET', '/audit', { cookie: admin.cookie })
    ).json()) as ApiPage<AuditEntrySummary>;

    expect(response.status).toBe(204);
    expect(list.total).toBe(0);
    expect(
      audit.items.find((entry) => entry.action === AuditActionEnum.Delete),
    ).toMatchObject({
      entity: AuditEntityEnum.Participant,
      entityName: 'Ada',
    });
  });

  test('GIVEN an Editor WHEN deleting a participant THEN answers 403', async () => {
    const { course, loginAs, request, seeder } = await setup();
    const participant = seeder.participant(course);
    const { cookie } = await loginAs({ email: 'editor@example.org' });

    const response = await request(
      'DELETE',
      `/courses/${course.id}/participants/${participant.id}`,
      { cookie },
    );

    expect(response.status).toBe(403);
  });
});

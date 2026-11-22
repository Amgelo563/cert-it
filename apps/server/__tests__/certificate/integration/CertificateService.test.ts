import {
  AuditActionEnum,
  AuditEntityEnum,
  type CertificateSummary,
  type JobSummary,
  JobTypeEnum,
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

// an Editor logged in through the API, with a course that has a template
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const harness = createApiHarness(database);
  const editor = await harness.loginAs({
    email: 'editor@example.org',
    role: RoleEnum.Editor,
  });
  const seeder = new MockSeeder(database.getRepositories());
  const course = seeder.course({ name: 'Networks' });
  const version = seeder.templateVersion(course, editor.user);
  const certificates = (
    path: string,
    body?: unknown,
    courseId: number = course.id,
  ) =>
    harness.request('POST', `/courses/${courseId}/certificates${path}`, {
      cookie: editor.cookie,
      body,
    });
  const auditEntries = (entity: string) =>
    database
      .getRepositories()
      .auditLog.list({ page: 1, size: 50 })
      .items.filter((entry) => entry.entity === entity);
  const findJob = (id: number) =>
    database.getRepositories().jobs.findById(id as never);

  return {
    ...harness,
    auditEntries,
    certificates,
    course,
    database,
    editor,
    findJob,
    seeder,
    version,
  };
}

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

describe('CertificateService (issue)', () => {
  test('GIVEN no participant IDs WHEN issuing THEN adds a job for every participant without a certificate, dated today, and audits it', async () => {
    const {
      auditEntries,
      certificates,
      course,
      editor,
      findJob,
      seeder,
      version,
    } = await setup();
    const ada = seeder.participant(course, { name: 'Ada' });
    const issued = seeder.participant(course, { name: 'Bob' });
    seeder.certificate(issued, version);
    const cy = seeder.participant(course, { name: 'Cy' });

    const response = await certificates('/issue', {});
    const job = (await response.json()) as JobSummary;

    expect(response.status).toBe(202);
    expect(job).toMatchObject({
      courseId: course.id,
      type: JobTypeEnum.Issue,
      status: 'pending',
      progress: 0,
      total: 2,
      output: null,
    });
    expect(findJob(job.id)).toMatchObject({
      payload: { participantIds: [ada.id, cy.id], issueDate: today() },
      createdBy: editor.user.id,
    });
    expect(auditEntries(AuditEntityEnum.Job)).toEqual([
      expect.objectContaining({
        action: AuditActionEnum.Issue,
        entityId: job.id,
        userId: editor.user.id,
        details: { courseId: course.id, participants: 2, issueDate: today() },
      }),
    ]);
  });

  test("GIVEN selected participants WHEN issuing THEN keeps only this course's without a certificate, once each, in order", async () => {
    const { certificates, course, findJob, seeder, version } = await setup();
    const ada = seeder.participant(course);
    const bob = seeder.participant(course);
    const issued = seeder.participant(course);
    seeder.certificate(issued, version);
    const other = seeder.participant(seeder.course());

    const response = await certificates('/issue', {
      participantIds: [bob.id, other.id, issued.id, ada.id, bob.id],
      issueDate: '2026-03-01',
    });
    const job = (await response.json()) as JobSummary;

    expect(response.status).toBe(202);
    expect(job.total).toBe(2);
    expect(findJob(job.id)?.payload).toEqual({
      participantIds: [bob.id, ada.id],
      issueDate: '2026-03-01',
    });
  });

  test('GIVEN every selected participant has a certificate WHEN issuing THEN answers 409 nothing_to_issue and adds no job', async () => {
    const { certificates, course, database, seeder, version } = await setup();
    const issued = seeder.participant(course);
    seeder.certificate(issued, version);

    const response = await certificates('/issue', {
      participantIds: [issued.id],
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'nothing_to_issue' });
    expect(
      database.getRepositories().jobs.listByCourse(course.id, {
        page: 1,
        size: 10,
      }).total,
    ).toBe(0);
  });

  test('GIVEN a course without a template WHEN issuing THEN answers 409 no_template', async () => {
    const { certificates, seeder } = await setup();
    const course = seeder.course();
    seeder.participant(course);

    const response = await certificates('/issue', {}, course.id);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'no_template' });
  });

  test.each([
    { body: { issueDate: '2026-02-30' } },
    { body: { issueDate: '20/11/2026' } },
    { body: { participantIds: [] } },
    { body: { participantIds: [0] } },
  ])('GIVEN $body WHEN issuing THEN answers 400', async ({ body }) => {
    const { certificates } = await setup();

    const response = await certificates('/issue', body);

    expect(response.status).toBe(400);
  });

  test('GIVEN an unknown course WHEN issuing THEN answers 404', async () => {
    const { certificates } = await setup();

    const response = await certificates('/issue', {}, 9_999);

    expect(response.status).toBe(404);
  });
});

describe('CertificateService (revoke)', () => {
  test('GIVEN an active certificate WHEN revoking it THEN saves the reason, audits it and its PDF stops being served at once', async () => {
    const {
      auditEntries,
      certificates,
      course,
      editor,
      requestPublic,
      seeder,
      version,
    } = await setup();
    const certificate = seeder.certificate(seeder.participant(course), version);
    const before = await requestPublic(`/c/${certificate.code}/pdf`);

    const response = await certificates(`/${certificate.id}/revoke`, {
      reason: '  Plagiarism  ',
    });
    const summary = (await response.json()) as CertificateSummary;

    expect(before.status).toBe(200);
    expect(response.status).toBe(200);
    expect(summary).toEqual({
      id: certificate.id,
      code: certificate.code,
      participantId: certificate.participantId,
      status: 'revoked',
      templateVersion: 1,
      issueDate: certificate.issueDate,
      revokedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      revokedReason: 'Plagiarism',
    });
    expect((await requestPublic(`/c/${certificate.code}/pdf`)).status).toBe(
      404,
    );
    expect(auditEntries(AuditEntityEnum.Certificate)).toEqual([
      expect.objectContaining({
        action: AuditActionEnum.Revoke,
        entityId: certificate.id,
        userId: editor.user.id,
        details: { code: certificate.code, reason: 'Plagiarism' },
      }),
    ]);
  });

  test('GIVEN a revoked certificate WHEN revoking it again THEN answers 409 certificate_revoked', async () => {
    const { certificates, course, seeder, version } = await setup();
    const certificate = seeder.certificate(seeder.participant(course), version);
    await certificates(`/${certificate.id}/revoke`, { reason: 'Duplicate' });

    const response = await certificates(`/${certificate.id}/revoke`, {
      reason: 'Again',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'certificate_revoked' });
  });

  test('GIVEN a blank reason WHEN revoking THEN answers 400', async () => {
    const { certificates, course, seeder, version } = await setup();
    const certificate = seeder.certificate(seeder.participant(course), version);

    const response = await certificates(`/${certificate.id}/revoke`, {
      reason: '   ',
    });

    expect(response.status).toBe(400);
  });

  test('GIVEN a certificate of another course WHEN revoking it through this one THEN answers 404', async () => {
    const { certificates, editor, seeder } = await setup();
    const other = seeder.course();
    const certificate = seeder.certificate(
      seeder.participant(other),
      seeder.templateVersion(other, editor.user),
    );

    const response = await certificates(`/${certificate.id}/revoke`, {
      reason: 'Wrong course',
    });

    expect(response.status).toBe(404);
  });
});

describe('CertificateService (reinstate)', () => {
  test('GIVEN a revoked certificate WHEN reinstating it THEN clears the revocation, audits it and serves its PDF again', async () => {
    const {
      auditEntries,
      certificates,
      course,
      requestPublic,
      seeder,
      version,
    } = await setup();
    const certificate = seeder.certificate(seeder.participant(course), version);
    await certificates(`/${certificate.id}/revoke`, { reason: 'Mistake' });

    const response = await certificates(`/${certificate.id}/reinstate`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'active',
      revokedAt: null,
      revokedReason: null,
    });
    expect((await requestPublic(`/c/${certificate.code}/pdf`)).status).toBe(
      200,
    );
    expect(
      auditEntries(AuditEntityEnum.Certificate).map((entry) => entry.action),
    ).toEqual([AuditActionEnum.Reinstate, AuditActionEnum.Revoke]);
  });

  test('GIVEN an active certificate WHEN reinstating it THEN answers 409 certificate_active', async () => {
    const { certificates, course, seeder, version } = await setup();
    const certificate = seeder.certificate(seeder.participant(course), version);

    const response = await certificates(`/${certificate.id}/reinstate`);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'certificate_active' });
  });
});

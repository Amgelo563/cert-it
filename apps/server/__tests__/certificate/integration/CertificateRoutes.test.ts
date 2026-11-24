import {
  AuditActionEnum,
  AuditEntityEnum,
  type CertificateSummary,
  type JobSummary,
  JobTypeEnum,
  RoleEnum,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import { existsSync } from 'node:fs';
import type { Certificate } from '../../../src/certificate/Certificate';
import { TestDataDirectories } from '../../storage/mocks/TestDataDirectories';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createApiHarness } from '../../http/mocks/createApiHarness';

const databases: DatabaseService[] = [];

const directories = new TestDataDirectories();

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  directories.removeAll();
});

// an Editor logged in through the API, with a course that has a template
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const dataDirectory = directories.create();
  const harness = createApiHarness(database, { dataDirectory });
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
  const writePdf = (certificate: Certificate) =>
    directories.writePdf(dataDirectory, certificate);

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
    writePdf,
  };
}

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

describe('CertificateRoutes (issue)', () => {
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

  test('GIVEN a latest template without a name field WHEN issuing THEN answers 409 no_template', async () => {
    const { certificates, editor, seeder } = await setup();
    const course = seeder.course();
    seeder.participant(course);
    seeder.templateVersion(course, editor.user, { schemas: [[]] });

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

describe('CertificateRoutes (revoke)', () => {
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

describe('CertificateRoutes (reinstate)', () => {
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

describe('CertificateRoutes (outdated)', () => {
  test('GIVEN certificates on two versions WHEN listing outdated THEN answers the older ones with names, sorted', async () => {
    const { course, editor, request, seeder, version } = await setup();
    const zoe = seeder.certificate(
      seeder.participant(course, { name: 'Zoe' }),
      version,
    );
    const ada = seeder.certificate(
      seeder.participant(course, { name: 'Ada' }),
      version,
    );
    const latest = seeder.templateVersion(course, editor.user);
    seeder.certificate(seeder.participant(course, { name: 'Cy' }), latest);

    const response = await request(
      'GET',
      `/courses/${course.id}/certificates/outdated`,
      { cookie: editor.cookie },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      latestVersion: 2,
      items: [
        {
          id: ada.id,
          code: ada.code,
          participantId: ada.participantId,
          name: 'Ada',
          templateVersion: 1,
        },
        expect.objectContaining({ id: zoe.id, name: 'Zoe' }),
      ],
    });
  });
});

describe('CertificateRoutes (regenerate)', () => {
  test('GIVEN outdated certificates WHEN regenerating all THEN adds a job to the latest version and audits it', async () => {
    const {
      auditEntries,
      certificates,
      course,
      editor,
      findJob,
      seeder,
      version,
    } = await setup();
    const old = seeder.certificate(seeder.participant(course), version);
    const latest = seeder.templateVersion(course, editor.user);
    seeder.certificate(seeder.participant(course), latest);

    const response = await certificates('/regenerate', {});
    const job = (await response.json()) as JobSummary;

    expect(response.status).toBe(202);
    expect(job).toMatchObject({ type: JobTypeEnum.Regenerate, total: 1 });
    expect(findJob(job.id)?.payload).toEqual({
      certificateIds: [old.id],
      templateVersionId: latest.id,
    });
    expect(auditEntries(AuditEntityEnum.Job)).toEqual([
      expect.objectContaining({
        action: AuditActionEnum.Regenerate,
        entityId: job.id,
        details: { courseId: course.id, certificates: 1, templateVersion: 2 },
      }),
    ]);
  });

  test('GIVEN a selection WHEN regenerating THEN keeps only the outdated ones', async () => {
    const { certificates, course, editor, findJob, seeder, version } =
      await setup();
    const first = seeder.certificate(seeder.participant(course), version);
    seeder.certificate(seeder.participant(course), version);
    const latest = seeder.templateVersion(course, editor.user);
    const current = seeder.certificate(seeder.participant(course), latest);

    const response = await certificates('/regenerate', {
      certificateIds: [first.id, current.id],
    });
    const job = (await response.json()) as JobSummary;

    expect(findJob(job.id)?.payload).toMatchObject({
      certificateIds: [first.id],
    });
  });

  test('GIVEN every certificate on the latest version WHEN regenerating THEN answers 409 nothing_to_regenerate', async () => {
    const { certificates, course, seeder, version } = await setup();
    seeder.certificate(seeder.participant(course), version);

    const response = await certificates('/regenerate', {});

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'nothing_to_regenerate' });
  });
});

describe('CertificateRoutes (update)', () => {
  test('GIVEN a new name and date WHEN editing THEN saves them and renders it again with its own version', async () => {
    const {
      auditEntries,
      course,
      database,
      editor,
      findJob,
      request,
      seeder,
      version,
    } = await setup();
    const certificate = seeder.certificate(
      seeder.participant(course, { name: 'Ada Lovelase' }),
      version,
    );
    seeder.templateVersion(course, editor.user);

    const response = await request(
      'PATCH',
      `/courses/${course.id}/certificates/${certificate.id}`,
      {
        cookie: editor.cookie,
        body: { name: ' Ada Lovelace ', issueDate: '2026-12-01' },
      },
    );
    const job = (await response.json()) as JobSummary;

    const repositories = database.getRepositories();
    expect(response.status).toBe(202);
    expect(findJob(job.id)?.payload).toEqual({
      certificateIds: [certificate.id],
      templateVersionId: version.id,
    });
    expect(
      repositories.participants.findById(certificate.participantId)?.name,
    ).toBe('Ada Lovelace');
    expect(repositories.certificates.findById(certificate.id)).toMatchObject({
      code: certificate.code,
      issueDate: '2026-12-01',
    });
    expect(auditEntries(AuditEntityEnum.Certificate)).toEqual([
      expect.objectContaining({
        action: AuditActionEnum.Update,
        details: {
          code: certificate.code,
          name: 'Ada Lovelace',
          issueDate: '2026-12-01',
        },
      }),
    ]);
  });

  test('GIVEN an empty body WHEN editing THEN answers 400', async () => {
    const { course, editor, request, seeder, version } = await setup();
    const certificate = seeder.certificate(seeder.participant(course), version);

    const response = await request(
      'PATCH',
      `/courses/${course.id}/certificates/${certificate.id}`,
      { cookie: editor.cookie, body: {} },
    );

    expect(response.status).toBe(400);
  });
});

describe('CertificateRoutes (delete)', () => {
  test('GIVEN an Admin WHEN deleting a certificate THEN removes its row and PDF and audits it', async () => {
    const {
      auditEntries,
      course,
      database,
      loginAs,
      request,
      seeder,
      version,
      writePdf,
    } = await setup();
    const admin = await loginAs({
      email: 'admin@example.org',
      role: RoleEnum.Admin,
    });
    const certificate = seeder.certificate(
      seeder.participant(course, { name: 'Ada' }),
      version,
    );
    const path = writePdf(certificate);

    const response = await request(
      'DELETE',
      `/courses/${course.id}/certificates/${certificate.id}`,
      { cookie: admin.cookie },
    );

    expect(response.status).toBe(204);
    expect(
      database.getRepositories().certificates.findById(certificate.id),
    ).toBeNull();
    expect(existsSync(path)).toBe(false);
    expect(auditEntries(AuditEntityEnum.Certificate)).toEqual([
      expect.objectContaining({
        action: AuditActionEnum.Delete,
        userId: admin.user.id,
        details: { code: certificate.code, name: 'Ada' },
      }),
    ]);
  });

  test('GIVEN an Editor WHEN deleting a certificate THEN answers 403 and keeps it', async () => {
    const { course, database, editor, request, seeder, version, writePdf } =
      await setup();
    const certificate = seeder.certificate(seeder.participant(course), version);
    const path = writePdf(certificate);

    const response = await request(
      'DELETE',
      `/courses/${course.id}/certificates/${certificate.id}`,
      { cookie: editor.cookie },
    );

    expect(response.status).toBe(403);
    expect(
      database.getRepositories().certificates.findById(certificate.id),
    ).not.toBeNull();
    expect(existsSync(path)).toBe(true);
  });
});

import { readFileSync, writeFileSync } from 'node:fs';
import { JobTypeEnum } from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { AuditLogService } from '../../../src/audit/AuditLogService';
import { AuthGuard } from '../../../src/auth/AuthGuard';
import { SessionService } from '../../../src/auth/session/SessionService';
import { CertificateRegenerator } from '../../../src/certificate/regenerate/CertificateRegenerator';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { StartupError } from '../../../src/error/StartupError';
import { BaseUrlService } from '../../../src/site/BaseUrlService';
import type { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { SiteUrl } from '@cert-it/hono';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { QueueOnlyJobService } from '../../job/mocks/QueueOnlyJobService';
import { TestDataDirectories } from '../../storage/mocks/TestDataDirectories';

const OldUrl = 'https://old.example.org/certs';

const NewUrl = 'https://certs.example.org';

const directories = new TestDataDirectories();

let database: DatabaseService;
let dataDirectory: DataDirectoryService;
let seeder: MockSeeder;
let lines: string[];

beforeEach(() => {
  database = createTestDatabase();
  dataDirectory = directories.create();
  seeder = new MockSeeder(database.getRepositories());
  lines = [];
});

afterEach(() => {
  database.close();
  directories.removeAll();
});

function createService(
  baseUrl: string,
  previousBaseUrl: string | null = null,
): BaseUrlService {
  const sessions = new SessionService({
    database,
    siteUrl: new SiteUrl({ baseUrl }),
  });
  const auditLog = new AuditLogService({
    database,
    guard: new AuthGuard({ sessions }),
  });

  return new BaseUrlService({
    baseUrl,
    previousBaseUrl,
    database,
    dataDirectory,
    regenerator: new CertificateRegenerator({
      auditLog,
      jobs: new QueueOnlyJobService(database),
    }),
    log: (line) => lines.push(line),
  });
}

function recorded(): unknown {
  return JSON.parse(readFileSync(dataDirectory.getSiteRecordPath(), 'utf8'));
}

// a certificate issued under the old address, which the service recorded
async function issueUnderOldUrl() {
  await createService(OldUrl).start();
  const course = seeder.course();
  const version = seeder.templateVersion(course, seeder.user());
  return seeder.certificate(seeder.participant(course), version);
}

function listJobs(courseId: Parameters<MockSeeder['participant']>[0]['id']) {
  return database
    .getRepositories()
    .jobs.listByCourse(courseId, { page: 1, size: 10 }).items;
}

describe('BaseUrlService (start)', () => {
  test('GIVEN a first start WHEN starting THEN records the address', async () => {
    await createService(`${NewUrl}/`).start();

    expect(recorded()).toEqual({ baseUrl: NewUrl });
  });

  test('GIVEN the same address with a trailing slash WHEN starting THEN starts', async () => {
    await issueUnderOldUrl();

    await expect(createService(`${OldUrl}/`).start()).resolves.toBeUndefined();
  });

  test('GIVEN a new address and nothing issued WHEN starting THEN records it without asking', async () => {
    await createService(OldUrl).start();

    await createService(NewUrl).start();

    expect(recorded()).toEqual({ baseUrl: NewUrl });
  });

  test('GIVEN a new address after issuing WHEN starting without previous_base_url THEN throws a StartupError that explains the move', async () => {
    await issueUnderOldUrl();

    const start = createService(NewUrl).start();

    await expect(start).rejects.toThrow(StartupError);
    await expect(createService(NewUrl).start()).rejects.toThrow(
      `site.base_url changed from ${OldUrl} to ${NewUrl}`,
    );
    await expect(createService(NewUrl).start()).rejects.toThrow(
      `set site.previous_base_url to ${OldUrl}`,
    );
    expect(recorded()).toEqual({ baseUrl: OldUrl });
  });

  test('GIVEN a previous_base_url other than the recorded one WHEN starting THEN still throws', async () => {
    await issueUnderOldUrl();

    await expect(
      createService(NewUrl, 'https://other.example.org').start(),
    ).rejects.toThrow(StartupError);
  });

  test('GIVEN a corrupt record WHEN starting THEN throws a StartupError naming it', async () => {
    writeFileSync(dataDirectory.getSiteRecordPath(), '{');

    await expect(createService(NewUrl).start()).rejects.toThrow(
      dataDirectory.getSiteRecordPath(),
    );
  });
});

describe('BaseUrlService (completeMove)', () => {
  test('GIVEN a confirmed move WHEN completing it THEN regenerates every certificate with its own version, records the address and says so', async () => {
    const certificate = await issueUnderOldUrl();
    const service = createService(NewUrl, `${OldUrl}/`);

    await service.start();
    await service.completeMove();

    expect(listJobs(certificate.courseId)).toMatchObject([
      {
        type: JobTypeEnum.Regenerate,
        createdBy: null,
        payload: {
          certificateIds: [certificate.id],
          templateVersionId: certificate.templateVersionId,
        },
      },
    ]);
    expect(recorded()).toEqual({ baseUrl: NewUrl });
    expect(lines).toEqual([
      `Moved from ${OldUrl} to ${NewUrl}: rendering every certificate again (1 in total) so their QR codes and credentials use the new address. `
        + `Keep ${OldUrl} redirecting here, since printed QR codes and credentials already handed out still use it.`,
    ]);
  });

  test('GIVEN a completed move WHEN starting again with previous_base_url still set THEN starts without regenerating', async () => {
    const certificate = await issueUnderOldUrl();
    const first = createService(NewUrl, OldUrl);
    await first.start();
    await first.completeMove();
    const again = createService(NewUrl, OldUrl);

    await again.start();
    await again.completeMove();

    expect(listJobs(certificate.courseId)).toHaveLength(1);
  });

  test('GIVEN no move WHEN completing THEN queues nothing', async () => {
    const certificate = await issueUnderOldUrl();
    const service = createService(OldUrl);

    await service.start();
    await service.completeMove();

    expect(listJobs(certificate.courseId)).toEqual([]);
    expect(lines).toEqual([]);
  });
});

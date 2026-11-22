import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RateLimiter, type SiteUrl } from '@cert-it/hono';
import { LocaleEnum } from '@cert-it/shared';
import { AuditLogService } from '../../../src/audit/AuditLogService';
import { AuthGuard } from '../../../src/auth/AuthGuard';
import { AuthService } from '../../../src/auth/AuthService';
import { createCsrfGuard } from '../../../src/auth/csrf/createCsrfGuard';
import { PasswordHasher } from '../../../src/auth/password/PasswordHasher';
import { SessionService } from '../../../src/auth/session/SessionService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { CourseService } from '../../../src/course/CourseService';
import {
  type ActiveCatalog,
  FontCatalogService,
} from '../../../src/font/catalog/FontCatalogService';
import { FontService } from '../../../src/font/FontService';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { TemplateService } from '../../../src/template/TemplateService';
import { createTestConfig } from '../../config/mocks/createTestConfig';
import { ParticipantService } from '../../../src/participant/ParticipantService';
import { CertificateService } from '../../../src/certificate/CertificateService';
import { JobService } from '../../../src/job/JobService';
import { QueueOnlyJobService } from '../../job/mocks/QueueOnlyJobService';
import { UserService } from '../../../src/user/UserService';

/** Returns the API service options of HttpService, with rate limits that tests can reach. Without a data directory, file routes use one that is never created. */
export function createAuthOptions(
  database: DatabaseService,
  siteUrl: SiteUrl,
  options: {
    maxAttempts?: number;
    now?: () => number;
    dataDirectory?: DataDirectoryService;
    /** The font catalog; none by default, so tests never reach the internet. */
    catalog?: ActiveCatalog;
  } = {},
) {
  const sessions = new SessionService({ database, siteUrl, now: options.now });
  const limiter = () =>
    new RateLimiter({
      maxHits: options.maxAttempts ?? 15,
      windowMs: 60_000,
      now: options.now,
    });
  const passwords = new PasswordHasher();
  const guard = new AuthGuard({ sessions });
  const auditLog = new AuditLogService({ database, guard });
  const auth = new AuthService({
    database,
    sessions,
    passwords,
    guard,
    auditLog,
    ipLimiter: limiter(),
    accountLimiter: limiter(),
  });

  const users = new UserService({
    database,
    passwords,
    sessions,
    guard,
    auditLog,
    firstAdminEmail: 'admin@example.org',
    log: () => {},
  });

  const courses = new CourseService({
    database,
    guard,
    auditLog,
    defaultLocale: LocaleEnum.En,
  });

  const participants = new ParticipantService({ database, guard, auditLog });

  const backgroundJobs = new QueueOnlyJobService(database);
  const certificates = new CertificateService({
    database,
    guard,
    auditLog,
    jobs: backgroundJobs,
  });
  const jobs = new JobService({
    database,
    guard,
    auditLog,
    jobs: backgroundJobs,
  });

  const dataDirectory =
    options.dataDirectory
    ?? new DataDirectoryService({
      root: join(tmpdir(), `cert-it-unused-${randomUUID()}`),
    });
  const services = {
    config: createTestConfig(),
    database,
    dataDirectory,
    guard,
    auditLog,
  };
  const fonts = FontService.create(services);
  const fontCatalog = new FontCatalogService({
    guard,
    fonts,
    active: options.catalog ?? null,
  });
  const templates = TemplateService.create(services);

  return {
    auth,
    users,
    courses,
    participants,
    certificates,
    jobs,
    fonts,
    fontCatalog,
    templates,
    auditLog,
    csrf: createCsrfGuard(siteUrl),
  };
}

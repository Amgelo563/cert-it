import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RateLimiter, type SiteUrl } from '@cert-it/hono';
import { LocaleEnum } from '@cert-it/shared';
import { AuditLog } from '../../../src/audit/AuditLog';
import { AuditLogRoutes } from '../../../src/audit/AuditLogRoutes';
import { AuthGuard } from '../../../src/auth/AuthGuard';
import { AuthRoutes } from '../../../src/auth/AuthRoutes';
import { ApiService } from '../../../src/http/api/ApiService';
import { PasswordHasher } from '../../../src/auth/password/PasswordHasher';
import { SessionService } from '../../../src/auth/session/SessionService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { CourseRoutes } from '../../../src/course/CourseRoutes';
import {
  type ActiveCatalog,
  FontCatalogRoutes,
} from '../../../src/font/catalog/FontCatalogRoutes';
import { FontLibrary } from '../../../src/font/FontLibrary';
import { FontRoutes } from '../../../src/font/FontRoutes';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { TemplateRoutes } from '../../../src/template/TemplateRoutes';
import { createTestConfig } from '../../config/mocks/createTestConfig';
import { ParticipantImporter } from '../../../src/participant/import/ParticipantImporter';
import { ParticipantRoutes } from '../../../src/participant/ParticipantRoutes';
import { CourseFieldRoutes } from '../../../src/field/CourseFieldRoutes';
import { FieldValueMerger } from '../../../src/field/FieldValueMerger';
import { FieldImageRoutes } from '../../../src/field/image/FieldImageRoutes';
import { CertificateManager } from '../../../src/certificate/CertificateManager';
import { CertificateRoutes } from '../../../src/certificate/CertificateRoutes';
import { CertificateRegenerator } from '../../../src/certificate/job/CertificateRegenerator';
import { CertificateExportRoutes } from '../../../src/certificate/export/CertificateExportRoutes';
import { JobRoutes } from '../../../src/job/JobRoutes';
import { OnboardingRoutes } from '../../../src/onboarding/OnboardingRoutes';
import { QueueOnlyJobService } from '../../job/mocks/QueueOnlyJobService';
import { UserRoutes } from '../../../src/user/UserRoutes';
import { createTestCredentials } from '../../credential/mocks/createTestCredentials';
import { MockLogger } from '../../log/mocks/MockLogger';
import { SystemClock } from '../../../src/clock/SystemClock';
import { CourseLoader } from '../../../src/course/CourseLoader';

/** Returns the options of ApiService, with rate limits that tests can reach. Without a data directory, file routes use one that is never created. */
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
  const { now } = options;
  const sessions = new SessionService({
    database,
    siteUrl,
    clock: now ? { now: () => new Date(now()) } : SystemClock.Instance,
  });
  const limiter = () =>
    new RateLimiter({
      maxHits: options.maxAttempts ?? 15,
      windowMs: 60_000,
      now: options.now,
    });
  const passwords = new PasswordHasher();
  const guard = new AuthGuard({ sessions });
  const courseLoader = new CourseLoader({ database });
  const auditLog = new AuditLog({ database });
  const auth = new AuthRoutes({
    database,
    sessions,
    passwords,
    guard,
    auditLog,
    ipLimiter: limiter(),
    accountLimiter: limiter(),
  });

  const users = new UserRoutes({
    database,
    passwords,
    sessions,
    guard,
    auditLog,
    firstAdminEmail: 'admin@example.org',
    logger: new MockLogger(),
  });

  const dataDirectory =
    options.dataDirectory
    ?? DataDirectoryService.create({
      root: join(tmpdir(), `cert-it-unused-${randomUUID()}`),
    });
  const backgroundJobs = new QueueOnlyJobService(database);
  const regenerator = new CertificateRegenerator({
    database,
    auditLog,
    jobs: backgroundJobs,
  });

  const courses = new CourseRoutes({
    database,
    guard,
    courseLoader,
    auditLog,
    defaultLocale: LocaleEnum.En,
    dataDirectory,
    logger: new MockLogger(),
  });

  const certificateManager = new CertificateManager({
    database,
    auditLog,
    jobs: backgroundJobs,
    dataDirectory,
    regenerator,
    logger: new MockLogger(),
    clock: SystemClock.Instance,
  });

  const participants = new ParticipantRoutes({
    database,
    guard,
    courseLoader,
    auditLog,
    certificates: certificateManager,
    regenerator,
    importer: new ParticipantImporter({ database }),
    merger: new FieldValueMerger({ dataDirectory }),
  });

  const certificates = new CertificateRoutes({
    database,
    guard,
    courseLoader,
    certificates: certificateManager,
  });
  const certificateExports = new CertificateExportRoutes({
    database,
    guard,
    courseLoader,
    dataDirectory,
    siteUrl,
    credentials: createTestCredentials(database, siteUrl).signer,
    logger: new MockLogger(),
  });
  const jobs = new JobRoutes({
    database,
    guard,
    courseLoader,
    auditLog,
    jobs: backgroundJobs,
  });

  const services = {
    config: createTestConfig(),
    database,
    dataDirectory,
    guard,
    auditLog,
  };
  const library = FontLibrary.create(services);
  const fonts = FontRoutes.create({ ...services, library });
  const fontCatalog = new FontCatalogRoutes({
    guard,
    library,
    active: options.catalog ?? null,
  });
  const templates = TemplateRoutes.create(services);

  return {
    auth,
    users,
    courses,
    participants,
    fields: CourseFieldRoutes.create({ database, guard, auditLog }),
    images: FieldImageRoutes.create({ database, dataDirectory, guard }),
    certificates,
    certificateExports,
    jobs,
    fonts,
    fontCatalog,
    templates,
    audit: new AuditLogRoutes({ database, guard }),
    onboarding: new OnboardingRoutes({ database, guard }),
    csrf: ApiService.createCsrfGuard(siteUrl),
  };
}

import type { SiteUrl } from '@cert-it/hono';
import { CsrfGuard } from '@cert-it/hono';
import { ApiErrorCodeEnum } from '@cert-it/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { AuditLog } from '../../audit/AuditLog';
import { AuditLogRoutes } from '../../audit/AuditLogRoutes';
import { AuthGuard } from '../../auth/AuthGuard';
import { AuthRoutes } from '../../auth/AuthRoutes';
import { PasswordHasher } from '../../auth/password/PasswordHasher';
import type { SessionService } from '../../auth/session/SessionService';
import { CertificateManager } from '../../certificate/CertificateManager';
import { CertificateRoutes } from '../../certificate/CertificateRoutes';
import { CertificateExportRoutes } from '../../certificate/export/CertificateExportRoutes';
import { CertificateRegenerator } from '../../certificate/job/CertificateRegenerator';
import type { CredentialSigner } from '../../credential/CredentialSigner';
import type { Config } from '../../config/schema/ConfigSchema';
import { CourseRoutes } from '../../course/CourseRoutes';
import type { DatabaseService } from '../../database/DatabaseService';
import { FontCatalogRoutes } from '../../font/catalog/FontCatalogRoutes';
import { FontLibrary } from '../../font/FontLibrary';
import { FontRoutes } from '../../font/FontRoutes';
import type { BackgroundJobService } from '../../job/BackgroundJobService';
import { JobRoutes } from '../../job/JobRoutes';
import { ParticipantRoutes } from '../../participant/ParticipantRoutes';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import { TemplateRoutes } from '../../template/TemplateRoutes';
import { UserRoutes } from '../../user/UserRoutes';
import type { HttpEnv } from '../HttpEnv';
import { AbstractApiRoutes } from './AbstractApiRoutes';
import type { Logger } from '../../log/Logger';

type ApiServiceOptions = {
  auth: AuthRoutes;
  users: UserRoutes;
  courses: CourseRoutes;
  participants: ParticipantRoutes;
  certificates: CertificateRoutes;
  certificateExports: CertificateExportRoutes;
  jobs: JobRoutes;
  fonts: FontRoutes;
  fontCatalog: FontCatalogRoutes;
  templates: TemplateRoutes;
  audit: AuditLogRoutes;
  csrf: CsrfGuard;
};

/** The admin panel's API: its routes, behind the CSRF guard and uncached by default. */
export class ApiService {
  public static readonly Path = '/api';

  protected readonly auth: AuthRoutes;

  protected readonly users: UserRoutes;

  protected readonly courses: CourseRoutes;

  protected readonly participants: ParticipantRoutes;

  protected readonly certificates: CertificateRoutes;

  protected readonly certificateExports: CertificateExportRoutes;

  protected readonly jobs: JobRoutes;

  protected readonly fonts: FontRoutes;

  protected readonly fontCatalog: FontCatalogRoutes;

  protected readonly templates: TemplateRoutes;

  protected readonly audit: AuditLogRoutes;

  protected readonly csrf: CsrfGuard;

  protected readonly app: ReturnType<ApiService['createApp']>;

  constructor(options: ApiServiceOptions) {
    this.auth = options.auth;
    this.users = options.users;
    this.courses = options.courses;
    this.participants = options.participants;
    this.certificates = options.certificates;
    this.certificateExports = options.certificateExports;
    this.jobs = options.jobs;
    this.fonts = options.fonts;
    this.fontCatalog = options.fontCatalog;
    this.templates = options.templates;
    this.audit = options.audit;
    this.csrf = options.csrf;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'admin' | 'auth' | 'fonts' | 'site' | 'uploads'>;
    siteUrl: SiteUrl;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    sessions: SessionService;
    backgroundJobs: BackgroundJobService;
    /** Signs the credentials the certificate exports include. */
    credentials: CredentialSigner;
    /** Also takes the dependencies shared by the default routes. */
    injections?: Partial<ApiServiceOptions> & {
      passwords?: PasswordHasher;
      guard?: AuthGuard;
      auditLog?: AuditLog;
      regenerator?: CertificateRegenerator;
      certificateManager?: CertificateManager;
      fontLibrary?: FontLibrary;
      logger?: Logger;
    };
  }): ApiService {
    const {
      config,
      siteUrl,
      database,
      dataDirectory,
      sessions,
      backgroundJobs: jobs,
      credentials,
      injections,
    } = options;
    const passwords = injections?.passwords ?? new PasswordHasher();
    const guard = injections?.guard ?? new AuthGuard({ sessions });
    const auditLog = injections?.auditLog ?? AuditLog.create({ database });
    const regenerator =
      injections?.regenerator
      ?? CertificateRegenerator.create({ database, auditLog, jobs });
    const certificates =
      injections?.certificateManager
      ?? CertificateManager.create({
        database,
        auditLog,
        jobs,
        dataDirectory,
        injections: { regenerator, logger: injections?.logger },
      });
    const library =
      injections?.fontLibrary
      ?? FontLibrary.create({ database, dataDirectory, auditLog });
    const shared = { config, database, passwords, sessions, guard, auditLog };
    const logged = { injections: { logger: injections?.logger } };

    return new ApiService({
      auth: injections?.auth ?? AuthRoutes.create(shared),
      users: injections?.users ?? UserRoutes.create({ ...shared, ...logged }),
      courses:
        injections?.courses
        ?? CourseRoutes.create({ ...shared, ...logged, dataDirectory }),
      participants:
        injections?.participants
        ?? ParticipantRoutes.create({
          database,
          guard,
          auditLog,
          certificates,
          regenerator,
        }),
      certificates:
        injections?.certificates
        ?? CertificateRoutes.create({ database, guard, certificates }),
      certificateExports:
        injections?.certificateExports
        ?? CertificateExportRoutes.create({
          ...shared,
          ...logged,
          siteUrl,
          dataDirectory,
          credentials,
        }),
      jobs: injections?.jobs ?? JobRoutes.create({ ...shared, jobs }),
      fonts: injections?.fonts ?? FontRoutes.create({ config, guard, library }),
      fontCatalog:
        injections?.fontCatalog
        ?? FontCatalogRoutes.create({ config, guard, library }),
      templates:
        injections?.templates
        ?? TemplateRoutes.create({ ...shared, dataDirectory }),
      audit: injections?.audit ?? AuditLogRoutes.create({ database, guard }),
      csrf: injections?.csrf ?? ApiService.createCsrfGuard(siteUrl),
    });
  }

  /** Returns the guard that answers cross-origin API writes with the cross_origin error. */
  public static createCsrfGuard(siteUrl: SiteUrl): CsrfGuard {
    return new CsrfGuard({
      // from base_url only, never from Host or X-Forwarded headers
      origin: siteUrl.getOrigin(),
      onReject: (c) =>
        AbstractApiRoutes.apiError(c, 403, ApiErrorCodeEnum.CrossOrigin),
    });
  }

  /** Creates the first Admin on an empty database. */
  public async start(): Promise<void> {
    await this.users.start();
  }

  /** Returns the API routes, relative to the base path, typed for the admin panel as CertItApi. */
  public getApp(): ApiService['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const app = new Hono<HttpEnv>({ strict: false });
    app.use(`${ApiService.Path}/*`, this.csrf.middleware(), this.noStore());

    return app
      .route(AuthRoutes.Path, this.auth.getApp())
      .route(UserRoutes.Path, this.users.getApp())
      .route(CourseRoutes.Path, this.courses.getApp())
      .route(ParticipantRoutes.Path, this.participants.getApp())
      .route(CertificateExportRoutes.Path, this.certificateExports.getApp())
      .route(CertificateRoutes.Path, this.certificates.getApp())
      .route(JobRoutes.Path, this.jobs.getApp())
      .route(TemplateRoutes.Path, this.templates.getApp())
      .route(FontRoutes.Path, this.fonts.getApp())
      .route(FontCatalogRoutes.Path, this.fontCatalog.getApp())
      .route(AuditLogRoutes.Path, this.audit.getApp());
  }

  // answers are per user and change with every write, unless a route says otherwise
  protected noStore(): MiddlewareHandler<HttpEnv> {
    return async (c, next) => {
      await next();
      if (!c.res.headers.has('Cache-Control')) {
        c.header('Cache-Control', 'no-store');
      }
    };
  }
}

import { type CsrfGuard, SiteUrl } from '@cert-it/hono';
import { Hono, type MiddlewareHandler } from 'hono';
import { AuditLogService } from '../../audit/AuditLogService';
import { AuthGuard } from '../../auth/AuthGuard';
import { AuthService } from '../../auth/AuthService';
import { createCsrfGuard } from '../../auth/csrf/createCsrfGuard';
import { PasswordHasher } from '../../auth/password/PasswordHasher';
import type { SessionService } from '../../auth/session/SessionService';
import { CertificateService } from '../../certificate/CertificateService';
import { CertificateExportService } from '../../certificate/export/CertificateExportService';
import type { CredentialSigner } from '../../credential/CredentialSigner';
import type { Config } from '../../config/schema/ConfigSchema';
import { CourseService } from '../../course/CourseService';
import type { DatabaseService } from '../../database/DatabaseService';
import { FontCatalogService } from '../../font/catalog/FontCatalogService';
import { FontService } from '../../font/FontService';
import type { BackgroundJobService } from '../../job/BackgroundJobService';
import { JobService } from '../../job/JobService';
import { ParticipantService } from '../../participant/ParticipantService';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import { TemplateService } from '../../template/TemplateService';
import { UserService } from '../../user/UserService';
import type { HttpEnv } from '../HttpEnv';

type ApiServiceOptions = {
  auth: AuthService;
  users: UserService;
  courses: CourseService;
  participants: ParticipantService;
  certificates: CertificateService;
  certificateExports: CertificateExportService;
  jobs: JobService;
  fonts: FontService;
  fontCatalog: FontCatalogService;
  templates: TemplateService;
  auditLog: AuditLogService;
  csrf: CsrfGuard;
};

/** The admin panel's API: its routes, behind the CSRF guard and uncached by default. */
export class ApiService {
  public static readonly Path = '/api';

  protected readonly auth: AuthService;

  protected readonly users: UserService;

  protected readonly courses: CourseService;

  protected readonly participants: ParticipantService;

  protected readonly certificates: CertificateService;

  protected readonly certificateExports: CertificateExportService;

  protected readonly jobs: JobService;

  protected readonly fonts: FontService;

  protected readonly fontCatalog: FontCatalogService;

  protected readonly templates: TemplateService;

  protected readonly auditLog: AuditLogService;

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
    this.auditLog = options.auditLog;
    this.csrf = options.csrf;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    sessions: SessionService;
    backgroundJobs: BackgroundJobService;
    /** Signs the credentials the certificate exports include. */
    credentials: CredentialSigner;
    /** Also takes the dependencies shared by the default services. */
    injections?: Partial<ApiServiceOptions> & {
      passwords?: PasswordHasher;
      guard?: AuthGuard;
    };
  }): ApiService {
    const {
      config,
      database,
      dataDirectory,
      sessions,
      backgroundJobs,
      credentials,
      injections,
    } = options;
    const passwords = injections?.passwords ?? new PasswordHasher();
    const guard = injections?.guard ?? new AuthGuard({ sessions });
    const auditLog =
      injections?.auditLog ?? new AuditLogService({ database, guard });
    const services = { config, database, passwords, sessions, guard, auditLog };
    const fonts =
      injections?.fonts ?? FontService.create({ ...services, dataDirectory });

    return new ApiService({
      auth: injections?.auth ?? AuthService.create(services),
      users: injections?.users ?? UserService.create(services),
      courses:
        injections?.courses
        ?? CourseService.create({ ...services, dataDirectory }),
      participants:
        injections?.participants
        ?? ParticipantService.create({
          ...services,
          dataDirectory,
          jobs: backgroundJobs,
        }),
      certificates:
        injections?.certificates
        ?? CertificateService.create({
          ...services,
          dataDirectory,
          jobs: backgroundJobs,
        }),
      certificateExports:
        injections?.certificateExports
        ?? CertificateExportService.create({
          ...services,
          dataDirectory,
          credentials,
        }),
      jobs:
        injections?.jobs
        ?? JobService.create({ ...services, jobs: backgroundJobs }),
      fonts,
      fontCatalog:
        injections?.fontCatalog
        ?? FontCatalogService.create({ ...services, fonts }),
      templates:
        injections?.templates
        ?? TemplateService.create({ ...services, dataDirectory }),
      auditLog,
      csrf:
        injections?.csrf
        ?? createCsrfGuard(new SiteUrl({ baseUrl: config.site.baseUrl })),
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
      .route(AuthService.Path, this.auth.getApp())
      .route(UserService.Path, this.users.getApp())
      .route(CourseService.Path, this.courses.getApp())
      .route(ParticipantService.Path, this.participants.getApp())
      .route(CertificateExportService.Path, this.certificateExports.getApp())
      .route(CertificateService.Path, this.certificates.getApp())
      .route(JobService.Path, this.jobs.getApp())
      .route(TemplateService.Path, this.templates.getApp())
      .route(FontService.Path, this.fonts.getApp())
      .route(FontCatalogService.Path, this.fontCatalog.getApp())
      .route(AuditLogService.Path, this.auditLog.getApp());
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

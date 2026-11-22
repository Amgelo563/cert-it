import { SiteUrl } from '@cert-it/hono';
import { AdminPanelService } from '../admin/AdminPanelService';
import { AuditLogService } from '../audit/AuditLogService';
import { AuthGuard } from '../auth/AuthGuard';
import { AuthService } from '../auth/AuthService';
import { PasswordHasher } from '../auth/password/PasswordHasher';
import { SessionService } from '../auth/session/SessionService';
import { CertificateFileService } from '../certificate/file/CertificateFileService';
import type { Config } from '../config/schema/ConfigSchema';
import { DatabaseService } from '../database/DatabaseService';
import { HttpService } from '../http/HttpService';
import { DataDirectoryService } from '../storage/DataDirectoryService';
import { StorageCleanupService } from '../storage/StorageCleanupService';
import { UserService } from '../user/UserService';
import { CourseService } from '../course/CourseService';
import { ParticipantService } from '../participant/ParticipantService';
import { FontCatalogService } from '../font/catalog/FontCatalogService';
import { FontService } from '../font/FontService';
import { TemplateService } from '../template/TemplateService';
import { BackgroundJobService } from '../job/BackgroundJobService';
import { JobService } from '../job/JobService';
import { CertificateService } from '../certificate/CertificateService';
import { CertificateExportService } from '../certificate/export/CertificateExportService';

type AppServiceOptions = {
  dataDirectory: DataDirectoryService;
  database: DatabaseService;
  passwords: PasswordHasher;
  sessions: SessionService;
  storageCleanup: StorageCleanupService;
  jobs: BackgroundJobService;
  users: UserService;
  adminPanel: AdminPanelService;
  http: HttpService;
};

/** Services that can replace the defaults, such as an in-memory database. */
export type AppServiceInjections = Partial<
  Pick<AppServiceOptions, 'dataDirectory' | 'database' | 'passwords'>
>;

/** The whole server: its services, started and stopped in order. */
export class AppService {
  protected readonly dataDirectory: DataDirectoryService;

  protected readonly database: DatabaseService;

  protected readonly passwords: PasswordHasher;

  protected readonly sessions: SessionService;

  protected readonly storageCleanup: StorageCleanupService;

  protected readonly jobs: BackgroundJobService;

  protected readonly users: UserService;

  protected readonly adminPanel: AdminPanelService;

  protected readonly http: HttpService;

  constructor(options: AppServiceOptions) {
    this.dataDirectory = options.dataDirectory;
    this.database = options.database;
    this.passwords = options.passwords;
    this.sessions = options.sessions;
    this.storageCleanup = options.storageCleanup;
    this.jobs = options.jobs;
    this.users = options.users;
    this.adminPanel = options.adminPanel;
    this.http = options.http;
  }

  public static create(options: {
    config: Config;
    injections?: AppServiceInjections;
  }): AppService {
    return new AppService(AppService.createServices(options));
  }

  /** Starts the app as the process's main program: exits if it can't start, and stops cleanly on SIGTERM or SIGINT. */
  public async run(): Promise<void> {
    try {
      await this.start();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.once(signal, () => {
        this.stop().then(
          () => process.exit(0),
          (error: unknown) => {
            console.error("Couldn't shut down cleanly:", error);
            process.exit(1);
          },
        );
      });
    }
  }

  /**
   * Starts every service and listens for requests, closing the database if any of them fails.
   *
   * @throws {StartupError} If a service can't start, such as when the port is taken.
   */
  public async start(): Promise<void> {
    try {
      this.dataDirectory.start();
      this.database.start();
      await this.startUsers();
      this.sessions.start();
      this.storageCleanup.start();
      this.jobs.start();
      await this.startAdminPanel();
      await this.http.start();
    } catch (error) {
      await this.jobs.stop({ graceMs: 0 });
      this.database.close();
      throw error;
    }
  }

  /** Stops listening, waits for open requests, then stops the services. */
  public async stop(): Promise<void> {
    await this.http.stop();
    this.sessions.stop();
    this.storageCleanup.stop();
    await this.jobs.stop();
    this.database.close();
  }

  // creates the first Admin on an empty database
  protected async startUsers(): Promise<void> {
    await this.users.start();
  }

  protected async startAdminPanel(): Promise<void> {
    await this.adminPanel.start();
  }

  // wires the services together, for create and subclasses
  protected static createServices(options: {
    config: Config;
    injections?: AppServiceInjections;
  }): AppServiceOptions {
    const { config, injections } = options;
    const dataDirectory =
      injections?.dataDirectory
      ?? new DataDirectoryService({ root: config.server.dataDir });
    const database =
      injections?.database
      ?? new DatabaseService({ path: dataDirectory.getDatabasePath() });
    const passwords = injections?.passwords ?? new PasswordHasher();
    const sessions = new SessionService({
      database,
      siteUrl: new SiteUrl({ baseUrl: config.site.baseUrl }),
    });
    const guard = new AuthGuard({ sessions });
    const auditLog = new AuditLogService({ database, guard });
    const services = { config, database, passwords, sessions, guard, auditLog };
    const users = UserService.create(services);
    const auth = AuthService.create(services);
    const jobs = BackgroundJobService.create({
      config,
      database,
      dataDirectory,
    });
    const courses = CourseService.create({ ...services, dataDirectory });
    const participants = ParticipantService.create({
      ...services,
      dataDirectory,
      jobs,
    });
    const certificates = CertificateService.create({
      ...services,
      dataDirectory,
      jobs,
    });
    const certificateExports = CertificateExportService.create({
      ...services,
      dataDirectory,
    });
    const jobRoutes = JobService.create({ ...services, jobs });
    const fonts = FontService.create({ ...services, dataDirectory });
    const fontCatalog = FontCatalogService.create({ ...services, fonts });
    const templates = TemplateService.create({ ...services, dataDirectory });
    const adminPanel = AdminPanelService.create({ config });
    const certificateFiles = CertificateFileService.create({
      config,
      database,
      dataDirectory,
    });
    const http = HttpService.create({
      config,
      database,
      adminPanel,
      certificateFiles,
      auth,
      users,
      courses,
      participants,
      certificates,
      certificateExports,
      jobs: jobRoutes,
      fonts,
      fontCatalog,
      templates,
      auditLog,
    });

    return {
      dataDirectory,
      database,
      passwords,
      sessions,
      storageCleanup: StorageCleanupService.create({ database, dataDirectory }),
      jobs,
      users,
      adminPanel,
      http,
    };
  }
}

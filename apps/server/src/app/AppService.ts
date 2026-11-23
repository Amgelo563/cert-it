import { SiteUrl } from '@cert-it/hono';
import { AdminPanelService } from '../admin/AdminPanelService';
import { AuditLogService } from '../audit/AuditLogService';
import { AuthGuard } from '../auth/AuthGuard';
import { PasswordHasher } from '../auth/password/PasswordHasher';
import { CertificateRegenerator } from '../certificate/regenerate/CertificateRegenerator';
import { SessionService } from '../auth/session/SessionService';
import type { Config } from '../config/schema/ConfigSchema';
import { CredentialService } from '../credential/CredentialService';
import { CredentialSigner } from '../credential/CredentialSigner';
import { IssuerKeyService } from '../credential/key/IssuerKeyService';
import { OpenBadgeBuilder } from '../credential/OpenBadgeBuilder';
import { DatabaseService } from '../database/DatabaseService';
import { ApiService } from '../http/api/ApiService';
import { HttpService } from '../http/HttpService';
import { MessagesService } from '../i18n/MessagesService';
import { BackgroundJobService } from '../job/BackgroundJobService';
import { PublicAssetsService } from '../page/PublicAssetsService';
import { LinkPreviewService } from '../page/preview/LinkPreviewService';
import { BaseUrlService } from '../site/BaseUrlService';
import { DataDirectoryService } from '../storage/DataDirectoryService';
import { StorageCleanupService } from '../storage/StorageCleanupService';

type AppServiceOptions = {
  dataDirectory: DataDirectoryService;
  database: DatabaseService;
  baseUrls: BaseUrlService;
  issuerKeys: IssuerKeyService;
  passwords: PasswordHasher;
  sessions: SessionService;
  storageCleanup: StorageCleanupService;
  jobs: BackgroundJobService;
  api: ApiService;
  adminPanel: AdminPanelService;
  publicAssets: PublicAssetsService;
  linkPreviews: LinkPreviewService;
  http: HttpService;
};

/** Services that can replace the defaults, such as an in-memory database. */
export type AppServiceInjections = Partial<
  Pick<
    AppServiceOptions,
    'dataDirectory' | 'database' | 'passwords' | 'publicAssets'
  >
>;

/** The whole server: its services, started and stopped in order. */
export class AppService {
  protected readonly dataDirectory: DataDirectoryService;

  protected readonly database: DatabaseService;

  protected readonly baseUrls: BaseUrlService;

  protected readonly issuerKeys: IssuerKeyService;

  protected readonly passwords: PasswordHasher;

  protected readonly sessions: SessionService;

  protected readonly storageCleanup: StorageCleanupService;

  protected readonly jobs: BackgroundJobService;

  protected readonly api: ApiService;

  protected readonly adminPanel: AdminPanelService;

  protected readonly publicAssets: PublicAssetsService;

  protected readonly linkPreviews: LinkPreviewService;

  protected readonly http: HttpService;

  constructor(options: AppServiceOptions) {
    this.dataDirectory = options.dataDirectory;
    this.database = options.database;
    this.baseUrls = options.baseUrls;
    this.issuerKeys = options.issuerKeys;
    this.passwords = options.passwords;
    this.sessions = options.sessions;
    this.storageCleanup = options.storageCleanup;
    this.jobs = options.jobs;
    this.api = options.api;
    this.adminPanel = options.adminPanel;
    this.publicAssets = options.publicAssets;
    this.linkPreviews = options.linkPreviews;
    this.http = options.http;
  }

  public static create(options: {
    config: Config;
    injections?: AppServiceInjections;
  }): AppService {
    return new AppService(AppService.createServices(options));
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
    const siteUrl = new SiteUrl({ baseUrl: config.site.baseUrl });
    const sessions = new SessionService({ database, siteUrl });
    const issuerKeys = new IssuerKeyService({
      path: dataDirectory.getIssuerKeyPath(),
      createMissing: true,
    });
    const badges = new OpenBadgeBuilder({
      siteUrl,
      orgName: config.site.orgName,
      messages: new MessagesService(),
    });
    const signer = new CredentialSigner({ keys: issuerKeys, builder: badges });
    const jobs = BackgroundJobService.create({
      config,
      database,
      dataDirectory,
    });
    const guard = new AuthGuard({ sessions });
    const auditLog = new AuditLogService({ database, guard });
    const api = ApiService.create({
      config,
      database,
      dataDirectory,
      sessions,
      backgroundJobs: jobs,
      credentials: signer,
      injections: { passwords, guard, auditLog },
    });
    const adminPanel = AdminPanelService.create({ config });
    const publicAssets =
      injections?.publicAssets ?? PublicAssetsService.create({ config });
    const linkPreviews = LinkPreviewService.create({ config, dataDirectory });
    const http = HttpService.create({
      config,
      database,
      dataDirectory,
      api,
      adminPanel,
      publicAssets,
      linkPreviews,
      credentials: new CredentialService({
        database,
        signer,
        builder: badges,
      }),
    });

    return {
      dataDirectory,
      database,
      baseUrls: new BaseUrlService({
        baseUrl: config.site.baseUrl,
        previousBaseUrl: config.site.previousBaseUrl ?? null,
        database,
        dataDirectory,
        regenerator: CertificateRegenerator.create({ auditLog, jobs }),
      }),
      issuerKeys,
      passwords,
      sessions,
      storageCleanup: StorageCleanupService.create({ database, dataDirectory }),
      jobs,
      api,
      adminPanel,
      publicAssets,
      linkPreviews,
      http,
    };
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
      // before anything is issued under a new address
      await this.baseUrls.start();
      // before the jobs, whose generator only reads the key
      await this.issuerKeys.start();
      await this.startUsers();
      this.sessions.start();
      this.storageCleanup.start();
      this.jobs.start();
      await this.baseUrls.completeMove();
      await this.startAdminPanel();
      this.publicAssets.start();
      this.linkPreviews.start();
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
    await this.api.start();
  }

  protected async startAdminPanel(): Promise<void> {
    await this.adminPanel.start();
  }
}

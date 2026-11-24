import { SiteUrl } from '@cert-it/hono';
import { AdminPanelService } from '../admin/AdminPanelService';
import { AuditLog } from '../audit/AuditLog';
import { AuthGuard } from '../auth/AuthGuard';
import { BackupService } from '../backup/BackupService';
import { PasswordHasher } from '../auth/password/PasswordHasher';
import { CertificateRegenerator } from '../certificate/job/CertificateRegenerator';
import { SessionService } from '../auth/session/SessionService';
import type { Config } from '../config/schema/ConfigSchema';
import { CredentialRoutes } from '../credential/CredentialRoutes';
import { CredentialSigner } from '../credential/CredentialSigner';
import { IssuerKeyService } from '../credential/key/IssuerKeyService';
import { DatabaseService } from '../database/DatabaseService';
import { ApiService } from '../http/api/ApiService';
import { HttpService } from '../http/HttpService';
import { BackgroundJobService } from '../job/BackgroundJobService';
import { PublicAssetsService } from '../page/PublicAssetsService';
import { LinkPreviewService } from '../page/preview/LinkPreviewService';
import { BaseUrlService } from '../site/BaseUrlService';
import { DataDirectoryService } from '../storage/DataDirectoryService';
import { StorageCleanupService } from '../storage/StorageCleanupService';
import { ConsoleLogger } from '../log/ConsoleLogger';
import type { Logger } from '../log/Logger';

type AppServiceOptions = {
  dataDirectory: DataDirectoryService;
  database: DatabaseService;
  baseUrls: BaseUrlService;
  issuerKeys: IssuerKeyService;
  passwords: PasswordHasher;
  sessions: SessionService;
  storageCleanup: StorageCleanupService;
  /** Null when backups are off. */
  backups: BackupService | null;
  jobs: BackgroundJobService;
  api: ApiService;
  adminPanel: AdminPanelService;
  publicAssets: PublicAssetsService;
  linkPreviews: LinkPreviewService;
  http: HttpService;
  logger: Logger;
};

/** Services that replace the defaults, such as an in-memory database. */
export type AppServiceInjections = Partial<AppServiceOptions>;

/** The whole server: its services, started and stopped in order. */
export class AppService {
  protected readonly dataDirectory: DataDirectoryService;

  protected readonly database: DatabaseService;

  protected readonly baseUrls: BaseUrlService;

  protected readonly issuerKeys: IssuerKeyService;

  protected readonly passwords: PasswordHasher;

  protected readonly sessions: SessionService;

  protected readonly storageCleanup: StorageCleanupService;

  protected readonly backups: BackupService | null;

  protected readonly jobs: BackgroundJobService;

  protected readonly api: ApiService;

  protected readonly adminPanel: AdminPanelService;

  protected readonly publicAssets: PublicAssetsService;

  protected readonly linkPreviews: LinkPreviewService;

  protected readonly http: HttpService;

  protected readonly logger: Logger;

  constructor(options: AppServiceOptions) {
    this.dataDirectory = options.dataDirectory;
    this.database = options.database;
    this.baseUrls = options.baseUrls;
    this.issuerKeys = options.issuerKeys;
    this.passwords = options.passwords;
    this.sessions = options.sessions;
    this.storageCleanup = options.storageCleanup;
    this.backups = options.backups;
    this.jobs = options.jobs;
    this.api = options.api;
    this.adminPanel = options.adminPanel;
    this.publicAssets = options.publicAssets;
    this.linkPreviews = options.linkPreviews;
    this.http = options.http;
    this.logger = options.logger;
  }

  public static create(options: {
    config: Config;
    /** @default built from site.base_url */
    siteUrl?: SiteUrl;
    injections?: AppServiceInjections;
  }): AppService {
    return new AppService(AppService.createServices(options));
  }

  // wires the services together, for create and subclasses
  protected static createServices(options: {
    config: Config;
    /** @default built from site.base_url */
    siteUrl?: SiteUrl;
    injections?: AppServiceInjections;
  }): AppServiceOptions {
    const { config, injections } = options;
    const logger = injections?.logger ?? ConsoleLogger.Instance;
    // one for the whole app
    const siteUrl =
      options.siteUrl ?? new SiteUrl({ baseUrl: config.site.baseUrl });
    const dataDirectory =
      injections?.dataDirectory
      ?? DataDirectoryService.create({ root: config.server.dataDir });
    const database =
      injections?.database ?? DatabaseService.create({ dataDirectory });
    const passwords = injections?.passwords ?? new PasswordHasher();
    const sessions =
      injections?.sessions ?? SessionService.create({ siteUrl, database });
    const issuerKeys =
      injections?.issuerKeys
      ?? IssuerKeyService.create({
        dataDirectory,
        createMissing: true,
        injections: { logger },
      });
    const signer = CredentialSigner.create({
      keys: issuerKeys,
      siteUrl,
      orgName: config.site.orgName,
    });
    const jobs =
      injections?.jobs
      ?? BackgroundJobService.create({ config, database, dataDirectory });
    const auditLog = AuditLog.create({ database });
    const regenerator = CertificateRegenerator.create({
      database,
      auditLog,
      jobs,
    });
    const api =
      injections?.api
      ?? ApiService.create({
        config,
        siteUrl,
        database,
        dataDirectory,
        sessions,
        backgroundJobs: jobs,
        credentials: signer,
        injections: {
          passwords,
          guard: AuthGuard.create({ sessions }),
          auditLog,
          regenerator,
          logger,
        },
      });
    const adminPanel =
      injections?.adminPanel ?? AdminPanelService.create({ config, siteUrl });
    const publicAssets =
      injections?.publicAssets ?? PublicAssetsService.create({ siteUrl });
    const linkPreviews =
      injections?.linkPreviews
      ?? LinkPreviewService.create({ config, siteUrl, dataDirectory });

    return {
      dataDirectory,
      database,
      baseUrls:
        injections?.baseUrls
        ?? BaseUrlService.create({
          config,
          database,
          dataDirectory,
          regenerator,
          injections: { logger },
        }),
      issuerKeys,
      passwords,
      sessions,
      storageCleanup:
        injections?.storageCleanup
        ?? StorageCleanupService.create({
          database,
          dataDirectory,
          injections: { logger },
        }),
      backups:
        injections?.backups !== undefined
          ? injections.backups
          : config.backup.enabled
            ? BackupService.create({
                config,
                database,
                dataDirectory,
                injections: { logger },
              })
            : null,
      jobs,
      api,
      adminPanel,
      publicAssets,
      linkPreviews,
      http:
        injections?.http
        ?? HttpService.create({
          config,
          siteUrl,
          database,
          dataDirectory,
          api,
          adminPanel,
          publicAssets,
          linkPreviews,
          credentials: CredentialRoutes.create({ database, signer }),
          injections: { logger },
        }),
      logger,
    };
  }

  /** Starts the app as the process's main program: exits if it can't start, and stops cleanly on SIGTERM or SIGINT. */
  public async run(): Promise<void> {
    try {
      await this.start();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.once(signal, () => {
        this.stop().then(
          () => process.exit(0),
          (error: unknown) => {
            this.logger.error("Couldn't shut down cleanly:", error);
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
      await this.backups?.start();
      this.jobs.start();
      await this.baseUrls.completeMove();
      await this.startAdminPanel();
      this.publicAssets.start();
      this.linkPreviews.start();
      await this.http.start();
    } catch (error) {
      await this.backups?.stop();
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
    await this.backups?.stop();
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

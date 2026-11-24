import { readFile } from 'node:fs/promises';
import { SiteUrl } from '@cert-it/hono';
import type { CertificateRegenerator } from '../certificate/job/CertificateRegenerator';
import type { DatabaseService } from '../database/DatabaseService';
import { StartupError } from '../error/StartupError';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import type { Config } from '../config/schema/ConfigSchema';
import { ConsoleLogger } from '../log/ConsoleLogger';
import type { Logger } from '../log/Logger';

type BaseUrlServiceOptions = {
  /** As in site.base_url. */
  baseUrl: string;
  /** As in site.previous_base_url, or null when it's empty. */
  previousBaseUrl: string | null;
  database: DatabaseService;
  dataDirectory: DataDirectoryService;
  regenerator: CertificateRegenerator;
  logger: Logger;
};

/** What the data directory records about the address. */
type SiteRecord = {
  baseUrl: string;
};

/** Records the address certificates are issued under, and stops the app when it changes unless site.previous_base_url confirms the move. QR codes and credentials already handed out keep the old address. */
export class BaseUrlService {
  protected readonly baseUrl: string;

  protected readonly previousBaseUrl: string | null;

  protected readonly database: DatabaseService;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly regenerator: CertificateRegenerator;

  protected readonly logger: Logger;

  /** The recorded address of a confirmed move not completed yet. */
  protected movedFrom: string | null = null;

  constructor(options: BaseUrlServiceOptions) {
    this.baseUrl = BaseUrlService.normalize(options.baseUrl);
    this.previousBaseUrl =
      options.previousBaseUrl === null
        ? null
        : BaseUrlService.normalize(options.previousBaseUrl);
    this.database = options.database;
    this.dataDirectory = options.dataDirectory;
    this.regenerator = options.regenerator;
    this.logger = options.logger;
  }

  public static create(options: {
    config: Pick<Config, 'site'>;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    regenerator: CertificateRegenerator;
    injections?: Partial<
      Pick<BaseUrlServiceOptions, 'baseUrl' | 'previousBaseUrl' | 'logger'>
    >;
  }): BaseUrlService {
    const { config, injections, ...shared } = options;

    return new BaseUrlService({
      ...shared,
      baseUrl: injections?.baseUrl ?? config.site.baseUrl,
      previousBaseUrl:
        injections?.previousBaseUrl !== undefined
          ? injections.previousBaseUrl
          : (config.site.previousBaseUrl ?? null),
      logger: injections?.logger ?? ConsoleLogger.Instance,
    });
  }

  /**
   * Compares site.base_url with the recorded address, recording it when nothing was issued under another one. Call it once the database is open.
   *
   * @throws {StartupError} If the address changed after certificates were issued and site.previous_base_url doesn't name the recorded one, or the record can't be read or written.
   */
  public async start(): Promise<void> {
    const recorded = await this.readRecord();
    if (recorded === this.baseUrl) return;

    // first start, or nothing issued that points to the old address
    const issued =
      this.database.getRepositories().certificates.findHighestId() > 0;
    if (recorded === null || !issued) {
      await this.writeRecord().catch((error: unknown) => {
        throw new StartupError(
          `Couldn't write ${this.dataDirectory.getSiteRecordPath()}`,
          { cause: error },
        );
      });
      return;
    }

    if (this.previousBaseUrl !== recorded) {
      throw new StartupError(
        `site.base_url changed from ${recorded} to ${this.baseUrl}`,
        {
          cause:
            `the QR codes and verifiable credentials of certificates already issued point to ${recorded}. `
            + `Redirect every path under ${recorded} to the same path under ${this.baseUrl}, `
            + `then set site.previous_base_url to ${recorded} to confirm the move`,
        },
      );
    }
    this.movedFrom = recorded;
  }

  /**
   * After a confirmed move, queues every certificate to be rendered again with the new address, then records it. Call it once jobs can be added.
   *
   * @throws {Error} If the record can't be written; the move is then completed again on the next start.
   */
  public async completeMove(): Promise<void> {
    const from = this.movedFrom;
    if (from === null) return;

    const count = this.regenerateAll();
    await this.writeRecord();
    this.movedFrom = null;
    this.logger.info(
      `Moved from ${from} to ${this.baseUrl}: rendering every certificate again (${count} in total) so their QR codes and credentials use the new address. `
        + `Keep ${from} redirecting here, since printed QR codes and credentials already handed out still use it.`,
    );
  }

  // every certificate again, each keeping its template version
  protected regenerateAll(): number {
    const all = this.database.getRepositories().certificates.listAll();
    this.regenerator.queueAll(all, null);
    return all.length;
  }

  protected async readRecord(): Promise<string | null> {
    const path = this.dataDirectory.getSiteRecordPath();
    try {
      const record = JSON.parse(await readFile(path, 'utf8')) as SiteRecord;
      return BaseUrlService.normalize(record.baseUrl);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new StartupError(`Couldn't read ${path}`, { cause: error });
    }
  }

  protected async writeRecord(): Promise<void> {
    const record: SiteRecord = { baseUrl: this.baseUrl };
    await this.dataDirectory.writeFile(
      this.dataDirectory.getSiteRecordPath(),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }

  // the same address written with or without a trailing slash
  protected static normalize(baseUrl: string): string {
    return new SiteUrl({ baseUrl }).url('');
  }
}

import { SiteUrl } from '@cert-it/hono';
import { JobWorker } from '@cert-it/jobs';
import { IssueJobHandler } from '../certificate/job/IssueJobHandler';
import { RegenerateJobHandler } from '../certificate/job/RegenerateJobHandler';
import { CredentialSigner } from '../credential/CredentialSigner';
import { IssuerKeyService } from '../credential/key/IssuerKeyService';
import { DatabaseService } from '../database/DatabaseService';
import type { Job } from '../job/Job';
import { JobTypeEnum } from '@cert-it/shared';
import { DataDirectoryService } from '../storage/DataDirectoryService';
import type { GeneratorSettings } from './GeneratorSettings';

type GeneratorServiceOptions = {
  database: DatabaseService;
  keys: IssuerKeyService;
  worker: JobWorker<Job>;
};

/** The generator process: runs the jobs the server's BackgroundJobService sends, on its own connection to the server's database. */
export class GeneratorService {
  protected readonly database: DatabaseService;

  protected readonly keys: IssuerKeyService;

  protected readonly worker: JobWorker<Job>;

  constructor(options: GeneratorServiceOptions) {
    this.database = options.database;
    this.keys = options.keys;
    this.worker = options.worker;
  }

  public static create(options: {
    settings: GeneratorSettings;
    injections?: Partial<GeneratorServiceOptions>;
  }): GeneratorService {
    const { settings, injections } = options;
    const dataDirectory = DataDirectoryService.create({
      root: settings.dataDir,
    });
    // the server migrates, and starts the data directory
    const database =
      injections?.database
      ?? DatabaseService.create({
        dataDirectory,
        injections: { path: settings.databasePath, migrate: false },
      });
    const siteUrl = new SiteUrl({ baseUrl: settings.baseUrl });
    // the server creates the key before it runs any job
    const keys =
      injections?.keys
      ?? IssuerKeyService.create({ dataDirectory, createMissing: false });
    const handlerOptions = {
      database,
      dataDirectory,
      siteUrl,
      credentials: CredentialSigner.create({
        keys,
        siteUrl,
        orgName: settings.orgName,
      }),
    };

    return new GeneratorService({
      database,
      keys,
      worker:
        injections?.worker
        ?? new JobWorker<Job>({
          handlers: {
            [JobTypeEnum.Issue]: IssueJobHandler.create(handlerOptions),
            [JobTypeEnum.Regenerate]:
              RegenerateJobHandler.create(handlerOptions),
          },
        }),
    });
  }

  /**
   * Reads the issuer key, opens the database and starts listening for jobs.
   *
   * @throws {StartupError} If the key can't be read or the database can't be opened.
   * @throws {Error} If this process wasn't started by the server's job runner.
   */
  public async start(): Promise<void> {
    await this.keys.start();
    this.database.start();
    this.worker.start();
  }
}

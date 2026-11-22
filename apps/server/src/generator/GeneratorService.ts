import { SiteUrl } from '@cert-it/hono';
import { JobWorker } from '@cert-it/jobs';
import { IssueJobHandler } from '../certificate/issue/IssueJobHandler';
import { RegenerateJobHandler } from '../certificate/issue/RegenerateJobHandler';
import { DatabaseService } from '../database/DatabaseService';
import type { Job } from '../job/Job';
import { JobTypeEnum } from '@cert-it/shared';
import { DataDirectoryService } from '../storage/DataDirectoryService';
import type { GeneratorSettings } from './GeneratorSettings';

type GeneratorServiceOptions = {
  database: DatabaseService;
  worker: JobWorker<Job>;
};

/** The generator process: runs the jobs the server's BackgroundJobService sends, on its own connection to the server's database. */
export class GeneratorService {
  protected readonly database: DatabaseService;

  protected readonly worker: JobWorker<Job>;

  constructor(options: GeneratorServiceOptions) {
    this.database = options.database;
    this.worker = options.worker;
  }

  public static create(settings: GeneratorSettings): GeneratorService {
    // the server migrates, and starts the data directory
    const database = new DatabaseService({
      path: settings.databasePath,
      migrate: false,
    });
    const handlerOptions = {
      database,
      dataDirectory: new DataDirectoryService({ root: settings.dataDir }),
      siteUrl: new SiteUrl({ baseUrl: settings.baseUrl }),
    };

    return new GeneratorService({
      database,
      worker: new JobWorker<Job>({
        handlers: {
          [JobTypeEnum.Issue]: new IssueJobHandler(handlerOptions),
          [JobTypeEnum.Regenerate]: new RegenerateJobHandler(handlerOptions),
        },
      }),
    });
  }

  /**
   * Opens the database and starts listening for jobs.
   *
   * @throws {StartupError} If the database can't be opened.
   * @throws {Error} If this process wasn't started by the server's job runner.
   */
  public start(): void {
    this.database.start();
    this.worker.start();
  }
}

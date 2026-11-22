import type { DuplicateModelError, ModelNotFoundError } from '@cert-it/data';
import {
  type JobId,
  type JobNotFailedError,
  JobRunner,
  SqliteJobService,
} from '@cert-it/jobs';
import type { Result } from 'better-result';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import type { GeneratorSettings } from '../generator/GeneratorSettings';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import type { Job } from './Job';
import type { NewJob } from './NewJob';
import { jobTable } from './repository/jobTable';

type BackgroundJobServiceOptions = {
  database: DatabaseService;
  /** Builds the generator's settings once the database is open. */
  settings: () => GeneratorSettings;
  /** @default the generator entry next to this module, .ts from source or .mjs when bundled */
  workerPath?: URL;
  /** Node flags for the generator. @default heap limits, plus the TypeScript loader when running from source */
  execArgv?: readonly string[];
};

/** Runs the jobs that generate certificates in the generator process, which starts when there's work and exits when there's none. */
export class BackgroundJobService {
  protected readonly database: DatabaseService;

  protected readonly settings: () => GeneratorSettings;

  protected readonly workerPath: URL;

  protected readonly execArgv: readonly string[];

  protected jobs: SqliteJobService<Job, typeof jobTable, NewJob> | null = null;

  constructor(options: BackgroundJobServiceOptions) {
    this.database = options.database;
    this.settings = options.settings;
    this.workerPath =
      options.workerPath ?? BackgroundJobService.defaultWorkerPath();
    this.execArgv = options.execArgv ?? BackgroundJobService.defaultExecArgv();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    injections?: Partial<BackgroundJobServiceOptions>;
  }): BackgroundJobService {
    const { config, database, dataDirectory, injections } = options;

    return new BackgroundJobService({
      database,
      settings: () => ({
        databasePath: database.getPath(),
        dataDir: dataDirectory.getRoot(),
        baseUrl: config.site.baseUrl,
      }),
      ...injections,
    });
  }

  /** Marks jobs a restart cut off as failed, then starts any pending ones. Call it once the database is open. */
  public start(): void {
    this.jobs = new SqliteJobService<Job, typeof jobTable, NewJob>({
      db: this.database.getExecutor(),
      table: jobTable,
      toModel: (row) => row as Job,
      workerPath: this.workerPath,
      args: [JSON.stringify(this.settings())],
      execArgv: this.execArgv,
    });
    this.jobs.start();
  }

  /** Stops the generator, waiting for the current job up to the given time. A job it cuts off is failed on the next start. */
  public async stop(options?: { graceMs?: number }): Promise<void> {
    await this.jobs?.stop(options);
    this.jobs = null;
  }

  /**
   * Adds a pending job and starts it if nothing else is running. Inside a transaction, it starts once the transaction commits.
   *
   * @throws {Error} If the service isn't started.
   */
  public add(data: NewJob): Result<Job, DuplicateModelError> {
    return this.getJobs().add(data);
  }

  /**
   * Puts a failed job back in the queue, to run it again.
   *
   * @throws {Error} If the service isn't started.
   */
  public retry(id: JobId): Result<Job, ModelNotFoundError | JobNotFailedError> {
    return this.getJobs().retry(id);
  }

  /** Returns whether a job is running. */
  public isBusy(): boolean {
    return this.jobs?.isBusy() ?? false;
  }

  protected getJobs(): SqliteJobService<Job, typeof jobTable, NewJob> {
    if (!this.jobs) throw new Error('BackgroundJobService is not started.');
    return this.jobs;
  }

  // bundled, the generator is its own entry next to the main file
  protected static defaultWorkerPath(): URL {
    return import.meta.url.endsWith('.ts')
      ? new URL('../generator/index.ts', import.meta.url)
      : new URL('./generator.mjs', import.meta.url);
  }

  // from source the generator needs the parent's TypeScript loader, but not a dev watcher
  protected static defaultExecArgv(): readonly string[] {
    const loader = import.meta.url.endsWith('.ts')
      ? process.execArgv.filter((flag) => !flag.startsWith('--watch'))
      : [];

    return [...loader, ...JobRunner.DefaultExecArgv];
  }
}

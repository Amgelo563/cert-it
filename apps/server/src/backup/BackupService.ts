import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { basename } from 'node:path';
import { Transform } from 'node:stream';
import { ManagedDirectory } from '@cert-it/file';
import { sql } from 'drizzle-orm';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { StartupError } from '../error/StartupError';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import { BackupArchive } from './archive/BackupArchive';
import { BackupFileName } from './archive/BackupFileName';
import { BackupRetention } from './retention/BackupRetention';
import { CronSchedule } from './schedule/CronSchedule';
import type { BackupStore } from './store/BackupStore';
import { RcloneBackupStore } from './store/RcloneBackupStore';

type BackupServiceOptions = {
  database: DatabaseService;
  dataDirectory: DataDirectoryService;
  store: BackupStore;
  /** rclone remotes, each a remote name and a path. */
  remotes: readonly string[];
  schedule: CronSchedule;
  retention: BackupRetention;
  /** @default () => new Date() */
  now?: () => Date;
  /** @default console.log */
  log?: (line: string) => void;
  /** @default console.error */
  logError?: (line: string, error: unknown) => void;
};

/** What one backup did. */
export type BackupResult = {
  /** Name of the archive, the same on every remote. */
  name: string;
  /** The remotes the archive reached. */
  uploaded: string[];
  /** The remotes it didn't, with why. */
  failed: { remote: string; error: unknown }[];
  /** How many old backups were deleted, over every remote. */
  deleted: number;
};

/** Takes scheduled backups: a database snapshot and the stored files in one ZIP, uploaded to every remote, then prunes old ones. */
export class BackupService {
  protected static readonly MinuteMs = 60_000;

  // fires a little after the minute starts, so a timer that's early still lands in it
  protected static readonly TickOffsetMs = 500;

  protected static readonly SnapshotSuffix = '.backup';

  protected readonly database: DatabaseService;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly store: BackupStore;

  protected readonly remotes: readonly string[];

  protected readonly schedule: CronSchedule;

  protected readonly retention: BackupRetention;

  protected readonly now: () => Date;

  protected readonly log: (line: string) => void;

  protected readonly logError: (line: string, error: unknown) => void;

  protected timer: NodeJS.Timeout | null = null;

  protected running: Promise<unknown> | null = null;

  protected abort: AbortController | null = null;

  protected lastMinute: number | null = null;

  constructor(options: BackupServiceOptions) {
    this.database = options.database;
    this.dataDirectory = options.dataDirectory;
    this.store = options.store;
    this.remotes = options.remotes;
    this.schedule = options.schedule;
    this.retention = options.retention;
    this.now = options.now ?? (() => new Date());
    this.log = options.log ?? console.log;
    this.logError = options.logError ?? console.error;
  }

  /**
   * Creates the service from the config's backup section, with rclone as the store.
   *
   * @throws {Error} If the schedule isn't a valid cron expression.
   */
  public static create(options: {
    config: Config;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    injections?: Partial<Pick<BackupServiceOptions, 'store'>>;
  }): BackupService {
    const { config, database, dataDirectory, injections } = options;
    const { backup } = config;
    const schedule = CronSchedule.parse(backup.schedule);
    if (!schedule)
      throw new Error(`Invalid backup schedule: ${backup.schedule}`);

    return new BackupService({
      database,
      dataDirectory,
      store: injections?.store ?? new RcloneBackupStore(),
      remotes: backup.remotes,
      schedule,
      retention: new BackupRetention({
        days: backup.retentionDays,
        copies: backup.retentionCopies,
      }),
    });
  }

  /**
   * Checks that the store can reach every remote's definition.
   *
   * @throws {StartupError} If rclone is missing or a remote isn't defined.
   */
  public async check(): Promise<void> {
    try {
      await this.store.check(this.remotes);
    } catch (error) {
      throw new StartupError("Backups can't run", { cause: error });
    }
  }

  /**
   * Checks the remotes, then backs up whenever the schedule says, in the background; failures are logged.
   *
   * @throws {StartupError} If rclone is missing or a remote isn't defined.
   */
  public async start(): Promise<void> {
    await this.check();
    this.scheduleTick();
  }

  /** Stops scheduling, cancels a backup in progress and waits for it to end. */
  public async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.abort?.abort();
    await this.running?.catch(() => {});
  }

  /**
   * Takes a backup now and uploads it to every remote. A remote that fails doesn't stop the others.
   *
   * @throws {Error} If the snapshot or the archive can't be made, so nothing was uploaded.
   */
  public async run(): Promise<BackupResult> {
    const abort = new AbortController();
    this.abort = abort;
    const run = this.backUp(abort.signal);
    this.running = run;

    try {
      return await run;
    } finally {
      if (this.running === run) this.running = null;
      if (this.abort === abort) this.abort = null;
    }
  }

  protected async backUp(signal: AbortSignal): Promise<BackupResult> {
    const name = BackupFileName.create(this.now());
    const result: BackupResult = { name, uploaded: [], failed: [], deleted: 0 };
    const snapshotPath = this.dataDirectory.resolve(
      `${basename(this.dataDirectory.getDatabasePath())}.${randomUUID()}${BackupService.SnapshotSuffix}${ManagedDirectory.TempFileSuffix}`,
    );

    try {
      this.takeSnapshot(snapshotPath);

      for (const remote of this.remotes) {
        signal.throwIfAborted();
        try {
          await this.upload(remote, name, snapshotPath, signal);
          result.uploaded.push(remote);
        } catch (error) {
          result.failed.push({ remote, error });
          this.logError(`Couldn't upload backup ${name} to ${remote}:`, error);
          continue;
        }

        try {
          result.deleted += await this.prune(remote, signal);
        } catch (error) {
          this.logError(`Couldn't delete old backups from ${remote}:`, error);
        }
      }
    } finally {
      await rm(snapshotPath, { force: true });
    }

    return result;
  }

  // a consistent copy, taken while the app keeps writing
  protected takeSnapshot(path: string): void {
    this.database.getExecutor().run(sql`VACUUM INTO ${path}`);
  }

  protected async upload(
    remote: string,
    name: string,
    snapshotPath: string,
    signal: AbortSignal,
  ): Promise<void> {
    const startedAt = Date.now();
    const archive = await new BackupArchive({
      root: this.dataDirectory.getRoot(),
      databaseFileName: basename(this.dataDirectory.getDatabasePath()),
      snapshotPath,
    }).open();

    let size = 0;
    const counted = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        callback(null, chunk);
      },
    });
    archive.once('error', (error) => counted.destroy(error));

    try {
      await this.store.upload(remote, name, archive.pipe(counted), signal);
    } catch (error) {
      archive.destroy();
      // so a partial file isn't mistaken for a backup
      await this.store.delete(remote, name).catch(() => {});
      throw error;
    }

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const kilobytes = size / 1024;
    const shown =
      kilobytes < 1024
        ? `${Math.ceil(kilobytes)} KB`
        : `${(kilobytes / 1024).toFixed(1)} MB`;
    this.log(`Uploaded backup ${name} to ${remote} (${shown} in ${seconds} s)`);
  }

  protected async prune(remote: string, signal: AbortSignal): Promise<number> {
    const expired = this.retention.selectExpired(
      await this.store.list(remote, signal),
      this.now(),
    );
    for (const file of expired) await this.store.delete(remote, file, signal);

    if (expired.length > 0) {
      this.log(`Deleted ${expired.length} old backups from ${remote}`);
    }

    return expired.length;
  }

  // checks the schedule once a minute; a backup still running when the next is due skips it
  protected scheduleTick(): void {
    const { MinuteMs, TickOffsetMs } = BackupService;
    const delay = MinuteMs - (this.now().getTime() % MinuteMs) + TickOffsetMs;

    this.timer = setTimeout(() => {
      this.tick();
      this.scheduleTick();
    }, delay);
    this.timer.unref();
  }

  protected tick(): void {
    const now = this.now();
    const minute = Math.floor(now.getTime() / BackupService.MinuteMs);
    if (minute === this.lastMinute || !this.schedule.matches(now)) return;
    this.lastMinute = minute;

    if (this.running) {
      this.log('Skipped a scheduled backup: the previous one is still running');
      return;
    }

    this.run().catch((error: unknown) =>
      this.logError("Couldn't take a backup:", error),
    );
  }
}

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { unzipSync } from 'fflate';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { BackupFileName } from '../../../src/backup/archive/BackupFileName';
import { BackupService } from '../../../src/backup/BackupService';
import { BackupRetention } from '../../../src/backup/retention/BackupRetention';
import { CronSchedule } from '../../../src/backup/schedule/CronSchedule';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { StartupError } from '../../../src/error/StartupError';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { TestDataDirectories } from '../../storage/mocks/TestDataDirectories';
import { backupStoreContract } from '../contract/backupStoreContract';
import { MockBackupStore } from '../mocks/MockBackupStore';
import { MockLogger } from '../../log/mocks/MockLogger';
import { MockClock } from '../../clock/mocks/MockClock';
import { SystemClock } from '../../../src/clock/SystemClock';

const Now = new Date('2026-11-23T03:00:00Z');
const Day = 24 * 60 * 60 * 1000;
const Remotes = ['s3:bucket/certs', 'gdrive:'];

const databases: DatabaseService[] = [];
const directories = new TestDataDirectories();

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  directories.removeAll();
  vi.useRealTimers();
});

function setup(options: { remotes?: string[]; copies?: number } = {}) {
  const database = createTestDatabase();
  databases.push(database);
  new MockSeeder(database.getRepositories()).user();
  const dataDirectory = directories.create();
  const root = dataDirectory.getRoot();
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };

  write('site.json', '{}');
  write('keys/issuer.pem', 'key');
  write('fonts/abc.woff2', 'font');
  write('templates/1/def.pdf', 'base');
  write('certificates/1/ABCD-EFGH-JK.pdf', 'pdf');
  // the live database and a write in progress, which a backup leaves out
  write('app.db', 'live');
  write('app.db-wal', 'wal');
  write('certificates/1/ABCD-EFGH-JK.pdf.123.tmp', 'partial');

  const store = new MockBackupStore({ defined: ['s3', 'gdrive'] });
  const logs: string[] = [];
  const backups = new BackupService({
    database,
    dataDirectory,
    store,
    remotes: options.remotes ?? Remotes,
    schedule: CronSchedule.parse('0 3 * * *')!,
    retention: new BackupRetention({ days: 30, copies: options.copies }),
    clock: new MockClock({ start: Now }),
    logger: new MockLogger({ lines: logs }),
  });

  return { backups, store, root, logs };
}

describe('MockBackupStore (contract)', () => {
  backupStoreContract(() => ({
    store: new MockBackupStore({ defined: ['backups'] }),
    remote: 'backups:folder',
  }));
});

describe('BackupService (run)', () => {
  test('GIVEN a data directory WHEN backed up THEN uploads its files with a database snapshot', async () => {
    const { backups, store } = setup();

    const result = await backups.run();

    expect(result).toEqual({
      name: BackupFileName.create(Now),
      uploaded: Remotes,
      failed: [],
      deleted: 0,
    });
    const files = unzipSync(store.getFile(Remotes[0]!, result.name)!);
    expect(Object.keys(files).toSorted()).toEqual([
      'app.db',
      'certificates/1/ABCD-EFGH-JK.pdf',
      'fonts/abc.woff2',
      'keys/issuer.pem',
      'site.json',
      'templates/1/def.pdf',
    ]);
    expect(Buffer.from(files['keys/issuer.pem']!).toString()).toBe('key');

    const snapshot = new Database(Buffer.from(files['app.db']!));
    expect(snapshot.prepare('SELECT count(*) AS n FROM users').get()).toEqual({
      n: 1,
    });
    snapshot.close();
  });

  test('GIVEN every remote WHEN backed up THEN uploads the same archive to each', async () => {
    const { backups, store } = setup();

    const { name } = await backups.run();

    expect(store.getFile(Remotes[1]!, name)).toEqual(
      store.getFile(Remotes[0]!, name),
    );
  });

  test('GIVEN a backup WHEN done THEN removes its snapshot', async () => {
    const { backups, root } = setup();

    await backups.run();

    expect(
      readdirSync(root).filter((name) => name.includes('.backup')),
    ).toEqual([]);
  });

  test('GIVEN a remote that fails WHEN backed up THEN uploads to the others and removes the partial file', async () => {
    const { backups, store, logs } = setup();
    store.failUploads(Remotes[0]!);

    const result = await backups.run();

    expect(result.uploaded).toEqual([Remotes[1]]);
    expect(result.failed.map(({ remote }) => remote)).toEqual([Remotes[0]]);
    expect(store.getFile(Remotes[0]!, result.name)).toBeUndefined();
    expect(logs).toContainEqual(expect.stringContaining("Couldn't upload"));
  });

  test('GIVEN old backups WHEN backed up THEN deletes the expired ones from each remote', async () => {
    const { backups, store } = setup({ copies: 2 });
    const old = (days: number) =>
      BackupFileName.create(new Date(Now.getTime() - days * Day));
    for (const remote of Remotes) {
      for (const days of [1, 2, 40]) {
        store.put(remote, old(days), Buffer.from('old'));
      }
      store.put(remote, 'notes.txt', Buffer.from('mine'));
    }

    const result = await backups.run();

    expect(result.deleted).toBe(4);
    for (const remote of Remotes) {
      expect((await store.list(remote)).toSorted()).toEqual(
        [result.name, old(1), 'notes.txt'].toSorted(),
      );
    }
  });

  test('GIVEN a remote that fails WHEN backed up THEN keeps its old backups', async () => {
    const { backups, store } = setup({ copies: 1 });
    const old = BackupFileName.create(new Date(Now.getTime() - Day));
    store.put(Remotes[0]!, old, Buffer.from('old')).failUploads(Remotes[0]!);

    await backups.run();

    expect(await store.list(Remotes[0]!)).toEqual([old]);
  });
});

describe('BackupService (start)', () => {
  test('GIVEN an undefined remote WHEN started THEN throws', async () => {
    const { backups } = setup({ remotes: ['dropbox:certs'] });

    await expect(backups.start()).rejects.toThrow(StartupError);
  });

  test('GIVEN a schedule WHEN its minute comes THEN backs up once', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    // 02:58:30 local time, so 03:00 comes in the second tick
    vi.setSystemTime(new Date(2026, 10, 23, 2, 58, 30));
    const database = createTestDatabase();
    databases.push(database);
    const backups = new BackupService({
      database,
      dataDirectory: directories.create(),
      store: new MockBackupStore({ defined: ['s3'] }),
      remotes: ['s3:bucket'],
      schedule: CronSchedule.parse('0 3 * * *')!,
      retention: new BackupRetention({ days: 30 }),
      clock: SystemClock.Instance,
      logger: new MockLogger(),
    });
    const run = vi.spyOn(backups, 'run').mockResolvedValue({
      name: 'x',
      uploaded: [],
      failed: [],
      deleted: 0,
    });

    await backups.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(run).toHaveBeenCalledTimes(1);
    await backups.stop();
  });
});

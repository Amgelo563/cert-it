import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { TransactionRollbackError } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vite-plus/test';
import type { JobId } from '../../../src/shared/job/Job';
import {
  type JobStatus,
  JobStatusEnum,
} from '../../../src/shared/job/JobStatusEnum';
import { SqliteJobDispatcher } from '../../../src/sqlite/dispatcher/SqliteJobDispatcher';
import { buildTestWorker } from '../../runner/mocks/buildTestWorker';
import {
  createTestJobQueue,
  type TestJobDatabase,
} from '../../sqlite/mocks/createTestJobQueue';
import {
  type TestJob,
  TestJobTypeEnum,
  type TestJobType,
} from '../../sqlite/mocks/TestJob';
import { testJobTable } from '../../sqlite/mocks/testJobTable';

const WaitTimeoutMs = 15_000;

let directory: string;
let workerPath: string;
let database: TestJobDatabase;
let service: SqliteJobDispatcher<TestJob, typeof testJobTable>;

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'jobs-service-'));
  workerPath = await buildTestWorker(directory);
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

beforeEach(() => {
  database = createTestJobQueue();
  service = new SqliteJobDispatcher<TestJob, typeof testJobTable>({
    db: database.db,
    table: testJobTable,
    workerPath,
    logError: () => {},
  });
  service.start();
});

afterEach(async () => {
  await service.stop({ graceMs: 0 });
  database.close();
});

function addJob(type: TestJobType = TestJobTypeEnum.Pid): TestJob {
  return service.add({ type, payload: {}, owner: 'test' }).unwrap();
}

async function waitForStatus(id: JobId, status: JobStatus): Promise<TestJob> {
  return vi.waitFor(
    () => {
      const job = database.queue.findById(id);
      expect(job?.status).toBe(status);
      return job!;
    },
    { timeout: WaitTimeoutMs, interval: 20 },
  );
}

describe('JobDispatcher (add)', () => {
  test('GIVEN a started service WHEN adding a job THEN runs it', async () => {
    const job = addJob();

    expect(
      (await waitForStatus(job.id, JobStatusEnum.Completed)).output,
    ).toEqual(expect.any(Number));
  });

  test('GIVEN a transaction that commits WHEN adding a job inside it THEN runs the job', async () => {
    let job: TestJob | undefined;
    database.db.transaction(() => {
      job = addJob();
    });

    const done = await waitForStatus(job!.id, JobStatusEnum.Completed);
    expect(done.error).toBeNull();
  });

  test('GIVEN a transaction that rolls back WHEN adding a job inside it THEN the job is never saved or run', async () => {
    let job: TestJob | undefined;
    expect(() =>
      database.db.transaction((tx) => {
        job = addJob();
        tx.rollback();
      }),
    ).toThrow(TransactionRollbackError);

    await sleep(200);

    expect(database.queue.findById(job!.id)).toBeNull();
    expect(service.isBusy()).toBe(false);
  });
});

describe('JobDispatcher (retry)', () => {
  test('GIVEN a failed job WHEN retrying it THEN runs it again', async () => {
    const job = database.add(TestJobTypeEnum.Pid);
    database.queue.claimNext(new Date());
    database.queue.fail(job.id, 'Boom', new Date());

    service.retry(job.id).unwrap();

    expect((await waitForStatus(job.id, JobStatusEnum.Completed)).error).toBe(
      null,
    );
  });
});

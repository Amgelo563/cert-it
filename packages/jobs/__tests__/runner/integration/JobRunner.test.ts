import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import { JobRunner } from '../../../src/shared/runner/JobRunner';
import {
  createTestJobQueue,
  type TestJobDatabase,
} from '../../sqlite/mocks/createTestJobQueue';
import { type TestJob, TestJobTypeEnum } from '../../sqlite/mocks/TestJob';
import { buildTestWorker } from '../mocks/buildTestWorker';

// small enough for the out-of-memory case to fail fast
const ExecArgv = ['--max-old-space-size=32'];
const WaitTimeoutMs = 15_000;

let directory: string;
let workerPath: string;
let queue: TestJobDatabase['queue'];
let add: TestJobDatabase['add'];
let close: () => void;
let runner: JobRunner<TestJob>;
let errors: string[];

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'jobs-runner-'));
  workerPath = await buildTestWorker(directory);
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

beforeEach(() => {
  ({ queue, add, close } = createTestJobQueue());
  errors = [];
  runner = createRunner();
});

afterEach(async () => {
  await runner.stop({ graceMs: 0 });
  close();
});

function createRunner(
  options: { progressIntervalMs?: number; timeoutMs?: number } = {},
): JobRunner<TestJob> {
  return new JobRunner({
    queue,
    workerPath,
    execArgv: ExecArgv,
    logError: (line) => errors.push(line),
    ...options,
  });
}

async function waitForStatus(id: JobId, status: JobStatus): Promise<TestJob> {
  return vi.waitFor(
    () => {
      const job = queue.findById(id);
      expect(job?.status).toBe(status);
      return job!;
    },
    { timeout: WaitTimeoutMs, interval: 20 },
  );
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('JobRunner (running)', () => {
  test('GIVEN pending jobs WHEN starting THEN runs them in order and saves their output and progress', async () => {
    const first = add(TestJobTypeEnum.Double, { n: 2 });
    const second = add(TestJobTypeEnum.Double, { n: 3 });

    runner.start();

    const firstDone = await waitForStatus(first.id, JobStatusEnum.Completed);
    const secondDone = await waitForStatus(second.id, JobStatusEnum.Completed);
    expect(firstDone).toMatchObject({
      output: { doubled: 4 },
      progress: 2,
      total: 2,
    });
    expect(secondDone).toMatchObject({ output: { doubled: 6 }, progress: 3 });
    expect(firstDone.finishedAt!.getTime()).toBeLessThanOrEqual(
      secondDone.startedAt!.getTime(),
    );
  });

  test('GIVEN a job that reports progress for every item WHEN running it THEN saves progress no more often than the interval', async () => {
    runner = createRunner({ progressIntervalMs: 60_000 });
    const setProgress = vi.spyOn(queue, 'setProgress');
    const job = add(TestJobTypeEnum.Double, { n: 1000 });

    runner.start();

    expect(await waitForStatus(job.id, JobStatusEnum.Completed)).toMatchObject({
      progress: 1000,
      total: 1000,
    });
    expect(setProgress.mock.calls.length).toBeLessThanOrEqual(2);
  });

  test('GIVEN back-to-back jobs WHEN running them THEN uses one worker, which exits once there are none left', async () => {
    const first = add(TestJobTypeEnum.Pid);
    const second = add(TestJobTypeEnum.Pid);

    runner.start();

    const pid = (await waitForStatus(first.id, JobStatusEnum.Completed))
      .output as number;
    expect(
      (await waitForStatus(second.id, JobStatusEnum.Completed)).output,
    ).toBe(pid);
    await vi.waitFor(() => expect(isAlive(pid)).toBe(false), {
      timeout: WaitTimeoutMs,
    });
    expect(runner.isBusy()).toBe(false);
  });

  test('GIVEN the worker exited WHEN a job is added and the runner woken THEN starts a new worker', async () => {
    const first = add(TestJobTypeEnum.Pid);
    runner.start();
    const pid = (await waitForStatus(first.id, JobStatusEnum.Completed))
      .output as number;
    await vi.waitFor(() => expect(isAlive(pid)).toBe(false), {
      timeout: WaitTimeoutMs,
    });

    const second = add(TestJobTypeEnum.Pid);
    runner.wake();

    const output = (await waitForStatus(second.id, JobStatusEnum.Completed))
      .output;
    expect(output).not.toBe(pid);
  });
});

describe('JobRunner (failures)', () => {
  test('GIVEN a handler that returns an error WHEN running it THEN fails the job without logging, and runs the next one', async () => {
    const failing = add(TestJobTypeEnum.Fail);
    const next = add(TestJobTypeEnum.Pid);

    runner.start();

    expect((await waitForStatus(failing.id, JobStatusEnum.Failed)).error).toBe(
      'Nothing to do.',
    );
    await waitForStatus(next.id, JobStatusEnum.Completed);
    expect(errors).toEqual([]);
  });

  test('GIVEN a handler that throws WHEN running it THEN fails and logs the job, and runs the next one', async () => {
    const throwing = add(TestJobTypeEnum.Throw);
    const next = add(TestJobTypeEnum.Pid);

    runner.start();

    expect((await waitForStatus(throwing.id, JobStatusEnum.Failed)).error).toBe(
      'Boom.',
    );
    await waitForStatus(next.id, JobStatusEnum.Completed);
    expect(errors).toEqual([
      expect.stringMatching(/^Job \d+ panicked: Error: Boom\./),
    ]);
  });

  test.each([
    {
      type: TestJobTypeEnum.Exit,
      error: 'The worker exited with code 3.',
    },
    {
      type: TestJobTypeEnum.OutOfMemory,
      error: 'The worker ran out of memory.',
    },
  ])(
    'GIVEN a worker that dies with $type WHEN running THEN fails and logs the job, and runs the next one in a new worker',
    async ({ type, error }) => {
      const dying = add(type);
      const next = add(TestJobTypeEnum.Pid);

      runner.start();

      expect((await waitForStatus(dying.id, JobStatusEnum.Failed)).error).toBe(
        error,
      );
      await waitForStatus(next.id, JobStatusEnum.Completed);
      expect(errors).toEqual([`Job ${dying.id} failed: ${error}`]);
    },
  );

  test('GIVEN a job type without a handler WHEN running it THEN fails and logs the job', async () => {
    const unknown = add('unknown' as TestJob['type']);

    runner.start();

    expect((await waitForStatus(unknown.id, JobStatusEnum.Failed)).error).toBe(
      'No handler for jobs of type "unknown".',
    );
    expect(errors).toHaveLength(1);
  });

  test('GIVEN a timeout WHEN a job runs longer THEN kills the worker and fails the job', async () => {
    runner = createRunner({ timeoutMs: 200 });
    const job = add(TestJobTypeEnum.Sleep, { ms: 60_000 });

    runner.start();

    expect((await waitForStatus(job.id, JobStatusEnum.Failed)).error).toBe(
      'The job took longer than 200 ms.',
    );
  });
});

describe('JobRunner (start and stop)', () => {
  test('GIVEN a job left running WHEN starting THEN fails it as interrupted', () => {
    const job = add(TestJobTypeEnum.Pid);
    queue.claimNext(new Date());

    runner.start();

    expect(queue.findById(job.id)).toMatchObject({
      status: JobStatusEnum.Failed,
      error: 'The job was interrupted by a restart.',
    });
  });

  test('GIVEN a short job WHEN stopping with enough grace THEN lets it finish', async () => {
    const job = add(TestJobTypeEnum.Sleep, { ms: 200 });
    runner.start();
    await waitForStatus(job.id, JobStatusEnum.Running);

    await runner.stop({ graceMs: 10_000 });

    expect(queue.findById(job.id)?.status).toBe(JobStatusEnum.Completed);
  });

  test('GIVEN a long job WHEN stopping with little grace THEN kills it and leaves it running for the next start', async () => {
    const job = add(TestJobTypeEnum.Sleep, { ms: 60_000 });
    runner.start();
    await waitForStatus(job.id, JobStatusEnum.Running);

    await runner.stop({ graceMs: 50 });

    expect(queue.findById(job.id)?.status).toBe(JobStatusEnum.Running);
    expect(errors).toEqual([]);
  });
});

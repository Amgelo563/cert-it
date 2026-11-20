import { ModelNotFoundError } from '@cert-it/data';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { JobNotFailedError } from '../../../../src/shared/job/errors/JobNotFailedError';
import type { JobId } from '../../../../src/shared/job/Job';
import { JobStatusEnum } from '../../../../src/shared/job/JobStatusEnum';
import {
  createTestJobQueue,
  type TestJobDatabase,
} from '../../mocks/createTestJobQueue';
import { TestJobTypeEnum } from '../../mocks/TestJob';

const Now = new Date('2026-11-20T12:00:00.000Z');
const Later = new Date('2026-11-20T12:05:00.000Z');

let queue: TestJobDatabase['queue'];
let add: TestJobDatabase['add'];
let close: () => void;

beforeEach(() => {
  ({ queue, add, close } = createTestJobQueue());
});

afterEach(() => {
  close();
});

function addRunning() {
  add(TestJobTypeEnum.Pid);
  return queue.claimNext(Now)!;
}

describe('SqliteJobQueue (enqueue)', () => {
  test('GIVEN a new job WHEN enqueuing it THEN saves it as pending with its payload', () => {
    const job = queue
      .enqueue({
        type: TestJobTypeEnum.Double,
        payload: { n: 2 },
        owner: 'ana',
      })
      .unwrap();

    expect(queue.findById(job.id)).toMatchObject({
      status: JobStatusEnum.Pending,
      payload: { n: 2 },
      owner: 'ana',
      progress: 0,
      total: null,
      output: null,
    });
  });
});

describe('SqliteJobQueue (claimNext)', () => {
  test('GIVEN pending jobs WHEN claiming THEN marks the oldest one running and returns it', () => {
    const first = add(TestJobTypeEnum.Double, { n: 1 });
    add(TestJobTypeEnum.Double, { n: 2 });

    const claimed = queue.claimNext(Now);

    expect(claimed).toMatchObject({
      id: first.id,
      status: JobStatusEnum.Running,
      startedAt: Now,
      payload: { n: 1 },
    });
    expect(queue.claimNext(Now)?.payload).toEqual({ n: 2 });
  });

  test('GIVEN no pending jobs WHEN claiming THEN returns null', () => {
    addRunning();

    expect(queue.claimNext(Now)).toBeNull();
  });
});

describe('SqliteJobQueue (setProgress)', () => {
  test('GIVEN a running job WHEN setting progress with and without a total THEN saves both', () => {
    const job = addRunning();

    queue.setProgress(job.id, 2, 10);
    queue.setProgress(job.id, 3);

    expect(queue.findById(job.id)).toMatchObject({
      progress: 3,
      total: 10,
    });
  });

  test('GIVEN a pending job WHEN setting progress THEN leaves it unchanged', () => {
    const job = add(TestJobTypeEnum.Pid);

    queue.setProgress(job.id, 5);

    expect(queue.findById(job.id)?.progress).toBe(0);
  });
});

describe('SqliteJobQueue (complete and fail)', () => {
  test('GIVEN a running job WHEN completing it THEN saves its output and finish time', () => {
    const job = addRunning();

    queue.complete(job.id, { names: ['Ana'] }, Later);

    expect(queue.findById(job.id)).toMatchObject({
      status: JobStatusEnum.Completed,
      output: { names: ['Ana'] },
      finishedAt: Later,
    });
  });

  test('GIVEN a running job WHEN completing it without output THEN saves a null output', () => {
    const job = addRunning();

    queue.complete(job.id, undefined, Later);

    expect(queue.findById(job.id)?.output).toBeNull();
  });

  test('GIVEN a running job WHEN failing it THEN saves the reason', () => {
    const job = addRunning();

    queue.fail(job.id, 'Missing template', Later);

    expect(queue.findById(job.id)).toMatchObject({
      status: JobStatusEnum.Failed,
      error: 'Missing template',
      finishedAt: Later,
    });
  });

  test('GIVEN a completed job WHEN failing it THEN keeps it completed', () => {
    const job = addRunning();
    queue.complete(job.id, null, Later);

    queue.fail(job.id, 'Too late', Later);

    expect(queue.findById(job.id)?.status).toBe(JobStatusEnum.Completed);
  });
});

describe('SqliteJobQueue (failRunning)', () => {
  test('GIVEN running and pending jobs WHEN failing running ones THEN fails only those and counts them', () => {
    const running = addRunning();
    const pending = add(TestJobTypeEnum.Pid);

    expect(queue.failRunning('Interrupted', Later)).toBe(1);
    expect(queue.findById(running.id)).toMatchObject({
      status: JobStatusEnum.Failed,
      error: 'Interrupted',
      finishedAt: Later,
    });
    expect(queue.findById(pending.id)?.status).toBe(JobStatusEnum.Pending);
  });
});

describe('SqliteJobQueue (retry)', () => {
  test('GIVEN a failed job WHEN retrying it THEN puts it back as pending and clears its run', () => {
    const job = addRunning();
    queue.setProgress(job.id, 4, 10);
    queue.fail(job.id, 'Boom', Later);

    const retried = queue.retry(job.id).unwrap();

    expect(retried).toMatchObject({
      status: JobStatusEnum.Pending,
      progress: 0,
      total: 10,
      output: null,
      error: null,
      startedAt: null,
      finishedAt: null,
    });
  });

  test.each([
    { status: JobStatusEnum.Pending, setup: () => add(TestJobTypeEnum.Pid) },
    { status: JobStatusEnum.Running, setup: addRunning },
  ])(
    'GIVEN a $status job WHEN retrying it THEN returns a JobNotFailedError',
    ({ status, setup }) => {
      const job = setup();

      const result = queue.retry(job.id);

      expect(result.isErr() && JobNotFailedError.is(result.error)).toBe(true);
      expect(result.isErr() && result.error).toMatchObject({ status });
    },
  );

  test('GIVEN no job with the ID WHEN retrying THEN returns a ModelNotFoundError', () => {
    const result = queue.retry(999 as JobId);

    expect(result.isErr() && ModelNotFoundError.is(result.error)).toBe(true);
  });
});

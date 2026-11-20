// worker for the runner tests, bundled by buildTestWorker
import { setTimeout as sleep } from 'node:timers/promises';
import { Result } from 'better-result';
import { JobWorker } from '../../../src/shared/worker/JobWorker';
import { type TestJob, TestJobTypeEnum } from '../../sqlite/mocks/TestJob';

new JobWorker<TestJob>({
  handlers: {
    [TestJobTypeEnum.Double]: {
      run: (job, context) => {
        const n = job.payload.n ?? 0;
        for (let i = 1; i <= n; i += 1) context.setProgress(i, n);

        return Promise.resolve(Result.ok({ doubled: n * 2 }));
      },
    },
    [TestJobTypeEnum.Fail]: {
      run: () => Promise.resolve(Result.err(new Error('Nothing to do.'))),
    },
    [TestJobTypeEnum.Throw]: {
      run: () => Promise.reject(new Error('Boom.')),
    },
    [TestJobTypeEnum.Exit]: {
      run: () => process.exit(3),
    },
    [TestJobTypeEnum.OutOfMemory]: {
      run: () => {
        const hog: number[][] = [];
        for (;;) hog.push(Array.from({ length: 100_000 }, Math.random));
      },
    },
    [TestJobTypeEnum.Sleep]: {
      run: async (job) => {
        await sleep(job.payload.ms ?? 0);
        return Result.ok(null);
      },
    },
    [TestJobTypeEnum.Pid]: {
      run: () => Promise.resolve(Result.ok(process.pid)),
    },
  },
}).start();

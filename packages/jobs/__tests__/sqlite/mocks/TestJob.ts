import type { Job } from '../../../src/shared/job/Job';

export const TestJobTypeEnum = {
  Double: 'double',
  Fail: 'fail',
  Throw: 'throw',
  Exit: 'exit',
  OutOfMemory: 'out_of_memory',
  Sleep: 'sleep',
  Tick: 'tick',
  Pid: 'pid',
  Args: 'args',
} as const;

export type TestJobType =
  (typeof TestJobTypeEnum)[keyof typeof TestJobTypeEnum];

export type TestJobPayload = { readonly n?: number; readonly ms?: number };

export type TestJob = Job<TestJobType, TestJobPayload> & {
  readonly owner: string;
};

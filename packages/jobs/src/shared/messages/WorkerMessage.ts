import type { JobId } from '../job/Job';
import type { WorkerMessageTypeEnum } from './WorkerMessageTypeEnum';

/** A message the worker sends the runner. */
export type WorkerMessage =
  | { readonly type: typeof WorkerMessageTypeEnum.Ready }
  | {
      readonly type: typeof WorkerMessageTypeEnum.Progress;
      readonly jobId: JobId;
      readonly progress: number;
      readonly total: number | undefined;
    }
  | {
      readonly type: typeof WorkerMessageTypeEnum.Completed;
      readonly jobId: JobId;
      readonly output: unknown;
    }
  | {
      readonly type: typeof WorkerMessageTypeEnum.Failed;
      readonly jobId: JobId;
      readonly error: string;
    }
  | {
      readonly type: typeof WorkerMessageTypeEnum.Panicked;
      readonly jobId: JobId;
      readonly message: string;
      readonly stack: string | null;
    };

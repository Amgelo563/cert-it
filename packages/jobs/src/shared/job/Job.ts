import type { Brand } from '@cert-it/shared';
import type { JobStatus } from './JobStatusEnum';

export type JobId = Brand<number, 'JobId'>;

/** A background job, with the type and payload that say what it does. */
export type Job<Type extends string = string, Payload = unknown> = {
  readonly id: JobId;
  readonly type: Type;
  readonly payload: Payload;
  readonly status: JobStatus;
  /** How many items are done. */
  readonly progress: number;
  /** How many items there are, or null if the handler hasn't said yet. */
  readonly total: number | null;
  /** What the handler returned, once the job is completed. */
  readonly output: unknown;
  /** Why the job failed, or null if it hasn't. */
  readonly error: string | null;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
};

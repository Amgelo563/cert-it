import type { CertificateJobResult } from './CertificateJobResult';
import type { JobStatus } from './JobStatusEnum';
import type { JobType } from './JobTypeEnum';

/** A background job of a course, as the job routes return it. */
export type JobSummary = {
  readonly id: number;
  readonly courseId: number;
  readonly type: JobType;
  readonly status: JobStatus;
  /** How many certificates are done. */
  readonly progress: number;
  /** How many there are, or null until the job starts counting. */
  readonly total: number | null;
  /** The result, once completed. */
  readonly output: CertificateJobResult | null;
  /** Why it failed, or null. */
  readonly error: string | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
};

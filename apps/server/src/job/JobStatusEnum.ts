export const JobStatusEnum = {
  Pending: 'pending',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
} as const;

/** The stage a background job is in. */
export type JobStatus = (typeof JobStatusEnum)[keyof typeof JobStatusEnum];

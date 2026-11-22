// same values as the jobs package's, which the server checks when it maps a job
export const JobStatusEnum = {
  Pending: 'pending',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
} as const;

/** Where a background job is in its run. */
export type JobStatus = (typeof JobStatusEnum)[keyof typeof JobStatusEnum];

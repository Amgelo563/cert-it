import { type JobSummary, JobStatusEnum } from '@cert-it/shared';

/** Returns whether a job may still change, so its progress is worth asking for. */
export function isJobActive(job: JobSummary): boolean {
  return (
    job.status === JobStatusEnum.Pending || job.status === JobStatusEnum.Running
  );
}

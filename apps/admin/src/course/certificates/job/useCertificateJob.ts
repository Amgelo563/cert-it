import { JobStatusEnum, type JobSummary } from '@cert-it/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from '../../../app/api/useApiClient';
import { isJobActive } from './isJobActive';

/** How often a pending or running job is asked for its progress. */
const PollMs = 1000;

/** The job a course's certificates tab follows, and what can be done with it. */
type CertificateJobState = {
  /** The followed job, or null when there is none to show. */
  job: JobSummary | null;
  /** Follows a job just added, such as by the issue dialog. */
  follow: (job: JobSummary) => void;
  /** Hides a finished job. */
  dismiss: () => void;
  /** Puts a failed job back in the queue and follows it again. */
  retry: () => Promise<void>;
};

/**
 * Follows a course's certificate job: on mount the latest one if it is unfinished or failed, then any job given to it, asking for its progress until it finishes.
 *
 * @param onFinished Called once when a followed job completes or fails, such as to reload the list.
 */
export function useCertificateJob(
  courseId: number,
  onFinished: (job: JobSummary) => void,
): CertificateJobState {
  const api = useApiClient();
  const [followed, setJob] = useState<JobSummary | null>(null);
  // a job followed on another course's tab is not this one's
  const job = followed?.courseId === courseId ? followed : null;
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });

  // a job left running or failed by an earlier visit
  useEffect(() => {
    let current = true;
    api
      .request((routes) =>
        routes.courses[':courseId'].jobs.$get({
          param: { courseId: String(courseId) },
          query: { page: '1', size: '1' },
        }),
      )
      .then(
        ({ items }) => {
          const latest = items[0];
          if (current && latest && latest.status !== JobStatusEnum.Completed) {
            setJob(latest);
          }
        },
        // the tab works without it
        () => {},
      );
    return () => {
      current = false;
    };
  }, [api, courseId]);

  useEffect(() => {
    if (!job || !isJobActive(job)) return;
    let current = true;

    const timer = setTimeout(() => {
      api
        .request((routes) =>
          routes.courses[':courseId'].jobs[':id'].$get({
            param: { courseId: String(courseId), id: String(job.id) },
          }),
        )
        .then(
          (next) => {
            if (!current) return;
            setJob(next);
            if (!isJobActive(next)) finished.current(next);
          },
          // a new object asks again after the delay
          () => {
            if (current) setJob({ ...job });
          },
        );
    }, PollMs);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [api, courseId, job]);

  const retry = useCallback(async () => {
    if (!job) return;
    const queued = await api.request((routes) =>
      routes.courses[':courseId'].jobs[':id'].retry.$post({
        param: { courseId: String(courseId), id: String(job.id) },
      }),
    );
    setJob(queued);
  }, [api, courseId, job]);

  return {
    job,
    follow: setJob,
    dismiss: useCallback(() => setJob(null), []),
    retry,
  };
}

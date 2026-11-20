import { describe, expectTypeOf, test } from 'vite-plus/test';
import type { Job } from '../../../src/shared/job/Job';
import type { JobOf } from '../../../src/shared/job/JobOf';

type ReportJob = JobOf<
  | { readonly type: 'monthly'; readonly payload: { month: number } }
  | { readonly type: 'yearly'; readonly payload: { year: number } }
>;

describe('JobOf', () => {
  test('GIVEN a union of tasks WHEN narrowing by type THEN gives that type its own payload', () => {
    expectTypeOf<
      Extract<ReportJob, { type: 'monthly' }>['payload']
    >().toEqualTypeOf<{
      month: number;
    }>();
    expectTypeOf<
      Extract<ReportJob, { type: 'yearly' }>['payload']
    >().toEqualTypeOf<{
      year: number;
    }>();
  });

  test('GIVEN a union of tasks WHEN building the job THEN it is still a Job', () => {
    expectTypeOf<ReportJob>().toExtend<Job>();
  });

  test('GIVEN a job with the payload of another type WHEN assigning it THEN fails to compile', () => {
    type MonthlyWithYearlyPayload = Omit<
      Extract<ReportJob, { type: 'monthly' }>,
      'payload'
    > & { readonly payload: { year: number } };

    expectTypeOf<MonthlyWithYearlyPayload>().not.toExtend<ReportJob>();
  });
});

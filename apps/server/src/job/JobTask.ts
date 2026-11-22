import type { IssueJobPayload } from './IssueJobPayload';
import type { JobTypeEnum } from '@cert-it/shared';
import type { RegenerateJobPayload } from './RegenerateJobPayload';

/** What a job does, with the input for it. */
export type JobTask =
  | {
      readonly type: typeof JobTypeEnum.Issue;
      readonly payload: IssueJobPayload;
    }
  | {
      readonly type: typeof JobTypeEnum.Regenerate;
      readonly payload: RegenerateJobPayload;
    };

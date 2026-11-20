import type { Job } from '../job/Job';
import type { RunnerMessageTypeEnum } from './RunnerMessageTypeEnum';

/** A message the runner sends the worker. */
export type RunnerMessage<J extends Job = Job> =
  | { readonly type: typeof RunnerMessageTypeEnum.Run; readonly job: J }
  | { readonly type: typeof RunnerMessageTypeEnum.Exit };

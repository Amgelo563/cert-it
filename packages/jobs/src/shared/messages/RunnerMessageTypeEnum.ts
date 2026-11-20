export const RunnerMessageTypeEnum = {
  Run: 'run',
  Exit: 'exit',
} as const;

/** A kind of message the runner sends the worker. */
export type RunnerMessageType =
  (typeof RunnerMessageTypeEnum)[keyof typeof RunnerMessageTypeEnum];

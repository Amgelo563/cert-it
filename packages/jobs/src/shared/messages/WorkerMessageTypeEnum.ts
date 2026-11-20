export const WorkerMessageTypeEnum = {
  Ready: 'ready',
  Progress: 'progress',
  Completed: 'completed',
  Failed: 'failed',
  Panicked: 'panicked',
} as const;

/** A kind of message the worker sends the runner. */
export type WorkerMessageType =
  (typeof WorkerMessageTypeEnum)[keyof typeof WorkerMessageTypeEnum];

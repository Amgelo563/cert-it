/** What a handler can use while it runs. */
export type JobContext = {
  /** Reports how many items are done, and how many there are when given. Cheap to call for every item. */
  setProgress(progress: number, total?: number): void;
};

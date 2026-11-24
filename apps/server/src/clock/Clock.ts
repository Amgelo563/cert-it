/** An object that tells the current time. */
export interface Clock {
  /** Returns the current time. */
  now(): Date;
}

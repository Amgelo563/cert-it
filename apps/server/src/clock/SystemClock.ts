import type { Clock } from './Clock';

/** Tells the time of the system clock. */
export class SystemClock implements Clock {
  public static readonly Instance = new SystemClock();

  public now(): Date {
    return new Date();
  }
}

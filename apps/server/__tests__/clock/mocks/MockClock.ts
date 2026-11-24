import type { Clock } from '../../../src/clock/Clock';

type MockClockOptions = {
  /** The time the clock starts at. */
  start: Date | number;
};

/** A Clock that stays at the time a test sets. */
export class MockClock implements Clock {
  protected time: number;

  constructor(options: MockClockOptions) {
    this.time = new Date(options.start).getTime();
  }

  public now(): Date {
    return new Date(this.time);
  }

  /** Moves the clock to the given time. */
  public set(time: Date | number): this {
    this.time = new Date(time).getTime();
    return this;
  }

  /** Moves the clock forward by the given milliseconds. */
  public advance(ms: number): this {
    this.time += ms;
    return this;
  }
}

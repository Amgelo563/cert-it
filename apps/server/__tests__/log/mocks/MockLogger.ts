import type { Logger } from '../../../src/log/Logger';

type MockLoggerOptions = {
  /** Where every line goes, info and error, in order. */
  lines?: string[];
};

/** A Logger that keeps every line, to check what a test logged. */
export class MockLogger implements Logger {
  /** Every line, info and error, in order. */
  public readonly lines: string[];

  /** Only the error lines. */
  public readonly errors: string[] = [];

  constructor(options: MockLoggerOptions = {}) {
    this.lines = options.lines ?? [];
  }

  public info(message: string): void {
    this.lines.push(message);
  }

  public error(message: string): void {
    this.lines.push(message);
    this.errors.push(message);
  }
}

import type { Logger } from './Logger';

/** Writes log lines to standard output, and errors to standard error. */
export class ConsoleLogger implements Logger {
  public static readonly Instance = new ConsoleLogger();

  public info(message: string): void {
    console.log(message);
  }

  public error(message: string, cause?: unknown): void {
    if (cause === undefined) console.error(message);
    else console.error(message, cause);
  }
}

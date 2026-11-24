/** An object that writes the app's log lines. */
export interface Logger {
  /** Writes a line about something that went as expected. */
  info(message: string): void;

  /** Writes a line about something that failed, with its cause when there is one. */
  error(message: string, cause?: unknown): void;
}

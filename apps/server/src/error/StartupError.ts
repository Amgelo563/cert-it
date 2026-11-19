/** An error for a service that couldn't start, with the reason in its message. */
export class StartupError extends Error {
  constructor(message: string, options: { cause: unknown }) {
    super(`${message}: ${StartupError.describe(options.cause)}`, options);
    this.name = 'StartupError';
  }

  // drizzle wraps the driver's error, whose message says what actually went wrong
  protected static describe(cause: unknown): string {
    if (!(cause instanceof Error)) return String(cause);

    return cause.cause instanceof Error
      ? `${cause.message} (${cause.cause.message})`
      : cause.message;
  }
}

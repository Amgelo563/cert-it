import type { ApiErrorCode } from '@cert-it/shared';

type ApiRequestErrorOptions = {
  /** HTTP status, or 0 if no response arrived. */
  status: number;
  /** Code from the response body, or null if it had none. */
  code: ApiErrorCode | null;
  /** Seconds to wait before trying again, from Retry-After. */
  retryAfterSeconds?: number | null;
  cause?: unknown;
};

/** An API request that failed, by an error response or a network failure. */
export class ApiRequestError extends Error {
  public readonly status: number;

  public readonly code: ApiErrorCode | null;

  public readonly retryAfterSeconds: number | null;

  constructor(options: ApiRequestErrorOptions) {
    super(
      options.status === 0
        ? 'The API could not be reached'
        : `The API answered ${options.status} ${options.code ?? ''}`.trim(),
      { cause: options.cause },
    );
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }

  /** Returns whether the given error is an ApiRequestError, with the given code if any. */
  public static matches(
    error: unknown,
    code?: ApiErrorCode,
  ): error is ApiRequestError {
    return (
      error instanceof ApiRequestError
      && (code === undefined || error.code === code)
    );
  }

  /** Returns whether no response arrived, such as when offline. */
  public isNetworkError(): boolean {
    return this.status === 0;
  }
}

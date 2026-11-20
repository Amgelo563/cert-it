import type { ApiError, ApiErrorCode } from '@cert-it/shared';
import type { Context, TypedResponse } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Answers an API error with its code, never cached; typed for `hono/client`. */
export function apiError<Status extends ContentfulStatusCode>(
  c: Context,
  status: Status,
  code: ApiErrorCode,
): Response & TypedResponse<ApiError, Status, 'json'> {
  c.header('Cache-Control', 'no-store');
  return c.json<ApiError, Status>({ error: code }, status);
}

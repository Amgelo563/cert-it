import type { ApiError, ApiErrorCode } from '@cert-it/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Answers an API error with its code, never cached. */
export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  code: ApiErrorCode,
): Response {
  c.header('Cache-Control', 'no-store');
  return c.json<ApiError>({ error: code }, status);
}

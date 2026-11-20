import { ApiErrorCodeEnum } from '@cert-it/shared';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { apiError } from './apiError';

// plenty for any JSON body of the admin routes
const MaxJsonBytes = 16 * 1024;

/** Answers 413 to bodies larger than a JSON request needs, or than the given size. */
export function jsonBodyLimit(maxBytes = MaxJsonBytes): MiddlewareHandler {
  return bodyLimit({
    maxSize: maxBytes,
    onError: (c) => apiError(c, 413, ApiErrorCodeEnum.InvalidRequest),
  });
}

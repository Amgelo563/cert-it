import { standardValidator, type StandardValidatorTarget } from '@cert-it/hono';
import { ApiErrorCodeEnum } from '@cert-it/shared';
import type { ZodType } from 'zod';
import { apiError } from './apiError';

/** Returns a middleware that checks the JSON body or query with the schema, answering invalid_request when it fails. */
export function apiValidator<
  Target extends StandardValidatorTarget,
  Schema extends ZodType,
>(target: Target, schema: Schema) {
  return standardValidator(target, schema, (c) =>
    apiError(c, 400, ApiErrorCodeEnum.InvalidRequest),
  );
}

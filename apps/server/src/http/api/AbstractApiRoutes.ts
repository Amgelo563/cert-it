import { standardValidator, type StandardValidatorTarget } from '@cert-it/hono';
import {
  type ApiError,
  type ApiErrorCode,
  ApiErrorCodeEnum,
} from '@cert-it/shared';
import type { Context, MiddlewareHandler, TypedResponse } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type {
  ClientErrorStatusCode,
  ContentfulStatusCode,
} from 'hono/utils/http-status';
import type { ZodType } from 'zod';

/** A group of admin API routes, with the error answers, validation and body limits they share. */
export abstract class AbstractApiRoutes {
  // plenty for any JSON body of the admin routes
  protected static readonly MaxJsonBytes = 16 * 1024;

  /** Status of each error code the routes answer, 400 when missing. */
  protected static readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {};

  /** Answers an API error with its code, never cached; typed for `hono/client`. */
  public static apiError<Status extends ContentfulStatusCode>(
    c: Context,
    status: Status,
    code: ApiErrorCode,
  ): Response & TypedResponse<ApiError, Status, 'json'> {
    c.header('Cache-Control', 'no-store');
    return c.json<ApiError, Status>({ error: code }, status);
  }

  /** Returns a positive integer ID from a path parameter, or null. */
  public static parseId(value: string | undefined): number | null {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  /** Returns a middleware that checks the JSON body or query with the schema, answering invalid_request when it fails. */
  protected static validator<
    Target extends StandardValidatorTarget,
    Schema extends ZodType,
  >(target: Target, schema: Schema) {
    return standardValidator(target, schema, (c) =>
      AbstractApiRoutes.apiError(c, 400, ApiErrorCodeEnum.InvalidRequest),
    );
  }

  /** Answers 413 to bodies larger than a JSON request needs, or than the given size. */
  protected static bodyLimit(
    maxBytes = AbstractApiRoutes.MaxJsonBytes,
  ): MiddlewareHandler {
    return bodyLimit({
      maxSize: maxBytes,
      onError: (c) =>
        AbstractApiRoutes.apiError(c, 413, ApiErrorCodeEnum.InvalidRequest),
    });
  }

  // the status comes from the subclass's own ErrorStatuses
  protected error(c: Context, code: ApiErrorCode) {
    const { ErrorStatuses } = this.constructor as typeof AbstractApiRoutes;
    return AbstractApiRoutes.apiError(c, ErrorStatuses[code] ?? 400, code);
  }
}

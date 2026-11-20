import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context, Env, MiddlewareHandler } from 'hono';

/** A part of the request standardValidator can check. */
export type StandardValidatorTarget = 'json' | 'query';

/**
 * Returns a middleware that parses the request's JSON body or query with the schema, for `c.req.valid(target)`, and types the route's input for `hono/client`.
 *
 * Malformed JSON and values the schema rejects are both answered with onInvalid.
 */
export function standardValidator<
  Target extends StandardValidatorTarget,
  Schema extends StandardSchemaV1,
  E extends Env = any,
  P extends string = string,
>(
  target: Target,
  schema: Schema,
  onInvalid: (c: Context<E, P>) => Response | Promise<Response>,
): MiddlewareHandler<
  E,
  P,
  {
    in: { [K in Target]: StandardSchemaV1.InferInput<Schema> };
    out: { [K in Target]: StandardSchemaV1.InferOutput<Schema> };
  }
> {
  return async (c, next) => {
    const value: unknown =
      target === 'json' ? await c.req.json().catch(() => null) : c.req.query();
    const result = await schema['~standard'].validate(value);
    if (result.issues) return onInvalid(c);

    c.req.addValidatedData(target, result.value as object);
    return next();
  };
}

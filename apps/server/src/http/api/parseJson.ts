import type { Context } from 'hono';
import type { ZodType } from 'zod';

/** Returns the request's JSON body parsed by the schema, or null if it's malformed or invalid. */
export async function parseJson<T>(
  c: Context,
  schema: ZodType<T>,
): Promise<T | null> {
  const json: unknown = await c.req.json().catch(() => null);
  const result = schema.safeParse(json);
  return result.success ? result.data : null;
}

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from 'hono';

/** Returns the request's JSON body parsed by the schema, or null if it's malformed or invalid. */
export async function parseJson<Schema extends StandardSchemaV1>(
  c: Context,
  schema: Schema,
): Promise<StandardSchemaV1.InferOutput<Schema> | null> {
  const json: unknown = await c.req.json().catch(() => null);
  const result = await schema['~standard'].validate(json);

  return result.issues ? null : result.value;
}

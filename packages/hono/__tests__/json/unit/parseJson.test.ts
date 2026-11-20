import type { StandardSchemaV1 } from '@standard-schema/spec';
import { Hono } from 'hono';
import { describe, expect, test } from 'vite-plus/test';
import { number, strictObject, string } from 'zod';
import { parseJson } from '../../../src/json/parseJson';

const LoginSchema = strictObject({ email: string(), age: number() });

// a schema whose validation is async, as Standard Schema allows
const AsyncNameSchema: StandardSchemaV1<unknown, { name: string }> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) =>
      Promise.resolve(
        typeof value === 'object'
          && value !== null
          && 'name' in value
          && typeof value.name === 'string'
          ? { value: { name: value.name } }
          : { issues: [{ message: 'Expected a name.' }] },
      ),
  },
};

async function post(
  body: string,
  schema: StandardSchemaV1 = LoginSchema,
): Promise<unknown> {
  const app = new Hono();
  app.post('/', async (c) => c.json({ parsed: await parseJson(c, schema) }));

  const response = await app.request('/', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
  return ((await response.json()) as { parsed: unknown }).parsed;
}

describe('parseJson', () => {
  test('GIVEN a valid body WHEN parsing THEN returns the parsed value', async () => {
    expect(await post('{"email":"a@b.c","age":3}')).toEqual({
      email: 'a@b.c',
      age: 3,
    });
  });

  test('GIVEN a body the schema rejects WHEN parsing THEN returns null', async () => {
    expect(await post('{"email":"a@b.c","age":"3"}')).toBeNull();
  });

  test('GIVEN malformed JSON WHEN parsing THEN returns null', async () => {
    expect(await post('{"email":')).toBeNull();
  });

  test('GIVEN an async schema WHEN parsing THEN awaits its result', async () => {
    expect(await post('{"name":"Ada"}', AsyncNameSchema)).toEqual({
      name: 'Ada',
    });
    expect(await post('{"name":3}', AsyncNameSchema)).toBeNull();
  });
});

import type { StandardSchemaV1 } from '@standard-schema/spec';
import { Hono } from 'hono';
import { describe, expect, test } from 'vite-plus/test';
import { coerce, number, object, strictObject, string } from 'zod';
import { standardValidator } from '../../../src/validation/standardValidator';

const LoginSchema = strictObject({ email: string(), age: number() });

const PageSchema = object({ page: coerce.number().int().min(1).default(1) });

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
): Promise<{ status: number; body: unknown }> {
  const app = new Hono().post(
    '/',
    standardValidator('json', schema, (c) => c.json({ invalid: true }, 400)),
    (c) => c.json({ parsed: c.req.valid('json') }),
  );

  const response = await app.request('/', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
  return { status: response.status, body: await response.json() };
}

async function get(query: string): Promise<{ status: number; body: unknown }> {
  const app = new Hono().get(
    '/',
    standardValidator('query', PageSchema, (c) =>
      c.json({ invalid: true }, 400),
    ),
    (c) => c.json({ parsed: c.req.valid('query') }),
  );

  const response = await app.request(`/${query}`);
  return { status: response.status, body: await response.json() };
}

describe('standardValidator (json)', () => {
  test('GIVEN a valid body WHEN validating THEN passes the parsed value on', async () => {
    expect(await post('{"email":"a@b.c","age":3}')).toEqual({
      status: 200,
      body: { parsed: { email: 'a@b.c', age: 3 } },
    });
  });

  test('GIVEN a body the schema rejects WHEN validating THEN answers with onInvalid', async () => {
    expect(await post('{"email":"a@b.c","age":"3"}')).toEqual({
      status: 400,
      body: { invalid: true },
    });
  });

  test('GIVEN malformed JSON WHEN validating THEN answers with onInvalid', async () => {
    expect((await post('{"email":')).status).toBe(400);
  });

  test('GIVEN an async schema WHEN validating THEN awaits its result', async () => {
    expect((await post('{"name":"Ada"}', AsyncNameSchema)).body).toEqual({
      parsed: { name: 'Ada' },
    });
    expect((await post('{"name":3}', AsyncNameSchema)).status).toBe(400);
  });
});

describe('standardValidator (query)', () => {
  test('GIVEN a valid query WHEN validating THEN passes the parsed value on', async () => {
    expect((await get('?page=3')).body).toEqual({ parsed: { page: 3 } });
    expect((await get('')).body).toEqual({ parsed: { page: 1 } });
  });

  test('GIVEN a query the schema rejects WHEN validating THEN answers with onInvalid', async () => {
    expect((await get('?page=0')).status).toBe(400);
  });
});

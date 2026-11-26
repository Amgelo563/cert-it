import {
  ApiErrorCodeEnum,
  type ApiPage,
  type CreatedUserResponse,
  type CurrentUser,
  RoleEnum,
  type UserSummary,
} from '@cert-it/shared';
import { describe, expect, expectTypeOf, test, vi } from 'vite-plus/test';
import { ApiClient } from '../../../../src/app/api/ApiClient';
import { ApiRequestError } from '../../../../src/app/api/errors/ApiRequestError';

const BaseUrl = new URL('https://example.org/certs/');

// a copy per call, since a body can only be read once
function createClient(response: Response | Error) {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response.clone()),
  );
  const client = ApiClient.create({ injections: { baseUrl: BaseUrl, fetch } });
  return { client, fetch };
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function requestOf(fetch: ReturnType<typeof createClient>['fetch']): Request {
  const [input, init] = fetch.mock.calls[0] ?? [];
  return new Request(input as string | URL, init);
}

async function catchError(promise: Promise<unknown>): Promise<ApiRequestError> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiRequestError);
  return error as ApiRequestError;
}

describe('ApiClient (types)', () => {
  test('GIVEN the server routes WHEN requesting THEN types the successful bodies', () => {
    const { client } = createClient(json({}));

    expectTypeOf(
      client.request((routes) => routes.auth.me.$get()),
    ).resolves.toMatchTypeOf<CurrentUser>();
    expectTypeOf(
      client.request((routes) => routes.users.$get({ query: { page: '1' } })),
    ).resolves.toMatchTypeOf<ApiPage<UserSummary>>();
    expectTypeOf(
      client.request((routes) =>
        routes.users.$post({
          json: { email: 'a@b.c', name: 'A', role: RoleEnum.Viewer },
        }),
      ),
    ).resolves.toMatchTypeOf<CreatedUserResponse>();
    expectTypeOf(
      client.request((routes) => routes.auth.logout.$post()),
    ).resolves.toBeUndefined();
  });
});

describe('ApiClient (requests)', () => {
  test('GIVEN a route and query WHEN requesting THEN sends them under the base URL', async () => {
    const { client, fetch } = createClient(json({ items: [] }));

    await client.request((routes) =>
      routes.users.$get({ query: { page: '2' } }),
    );

    const request = requestOf(fetch);
    expect(request.url).toBe('https://example.org/certs/api/users?page=2');
    expect(request.method).toBe('GET');
  });

  test('GIVEN a body WHEN requesting THEN sends it as JSON and returns the parsed answer', async () => {
    const { client, fetch } = createClient(json({ id: 1 }));

    const user = await client.request((routes) =>
      routes.auth.login.$post({ json: { email: 'a@b.c', password: 'x' } }),
    );

    const request = requestOf(fetch);
    expect(user).toEqual({ id: 1 });
    expect(await request.text()).toBe('{"email":"a@b.c","password":"x"}');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.credentials).toBe('same-origin');
  });

  test('GIVEN a 204 answer WHEN requesting THEN returns undefined', async () => {
    const { client } = createClient(new Response(null, { status: 204 }));

    await expect(
      client.request((routes) => routes.auth.logout.$post()),
    ).resolves.toBeUndefined();
  });
});

describe('ApiClient (errors)', () => {
  test('GIVEN an error body WHEN requesting THEN throws with its status and code', async () => {
    const { client } = createClient(
      json({ error: ApiErrorCodeEnum.EmailTaken }, { status: 409 }),
    );

    const error = await catchError(
      client.request((routes) =>
        routes.users.$post({
          json: { email: 'a@b.c', name: 'A', role: RoleEnum.Admin },
        }),
      ),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe(ApiErrorCodeEnum.EmailTaken);
  });

  test('GIVEN a 429 with Retry-After WHEN requesting THEN keeps the wait', async () => {
    const { client } = createClient(
      json(
        { error: ApiErrorCodeEnum.TooManyAttempts },
        { status: 429, headers: { 'Retry-After': '90' } },
      ),
    );

    const error = await catchError(
      client.request((routes) =>
        routes.auth.login.$post({ json: { email: 'a@b.c', password: 'x' } }),
      ),
    );

    expect(error.retryAfterSeconds).toBe(90);
  });

  test('GIVEN a body that is not an API error WHEN requesting THEN throws without a code', async () => {
    const { client } = createClient(
      new Response('<h1>Bad gateway</h1>', { status: 502 }),
    );

    const error = await catchError(
      client.request((routes) => routes.auth.me.$get()),
    );

    expect(error.status).toBe(502);
    expect(error.code).toBeNull();
  });

  test('GIVEN a network failure WHEN requesting THEN throws a network error', async () => {
    const { client } = createClient(new TypeError('Failed to fetch'));

    const error = await catchError(
      client.request((routes) => routes.auth.me.$get()),
    );

    expect(error.isNetworkError()).toBe(true);
  });

  test('GIVEN a listener WHEN a request fails THEN calls it until removed', async () => {
    const { client } = createClient(
      json({ error: ApiErrorCodeEnum.Unauthorized }, { status: 401 }),
    );
    const listener = vi.fn<(error: ApiRequestError) => void>();
    const remove = client.onError(listener);

    await catchError(client.request((routes) => routes.auth.me.$get()));
    remove();
    await catchError(client.request((routes) => routes.auth.me.$get()));

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ status: 401 });
  });
});

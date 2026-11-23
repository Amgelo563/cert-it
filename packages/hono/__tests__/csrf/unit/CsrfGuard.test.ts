import { Hono } from 'hono';
import { describe, expect, test } from 'vite-plus/test';
import { CsrfGuard } from '../../../src/csrf/CsrfGuard';

const Origin = 'https://certs.example.org';

function createApp(guard = new CsrfGuard({ origin: Origin })): Hono {
  const app = new Hono();
  app.use(guard.middleware());
  app.all('/', (c) => c.body(null, 204));

  return app;
}

function request(
  method: string,
  headers: Record<string, string> = {},
  app = createApp(),
): Promise<Response> {
  return Promise.resolve(app.request('/', { method, headers }));
}

describe('CsrfGuard (middleware)', () => {
  test.each(['GET', 'HEAD', 'OPTIONS'])(
    'GIVEN another Origin WHEN sending a safe %s THEN lets it through',
    async (method) => {
      const response = await request(method, {
        origin: 'https://evil.example',
      });

      expect(response.status).toBe(204);
    },
  );

  test('GIVEN the app origin WHEN posting THEN lets it through', async () => {
    expect((await request('POST', { origin: Origin })).status).toBe(204);
  });

  test.each(['https://evil.example', 'http://certs.example.org'])(
    'GIVEN the Origin %s WHEN posting THEN answers 403',
    async (origin) => {
      const response = await request('POST', { origin });

      expect(response.status).toBe(403);
      expect(await response.text()).toBe('Forbidden');
    },
  );

  test('GIVEN neither Origin nor Sec-Fetch-Site WHEN posting THEN answers 403', async () => {
    expect((await request('POST')).status).toBe(403);
  });

  test('GIVEN no Origin but a same-origin fetch WHEN posting THEN lets it through', async () => {
    const response = await request('POST', { 'sec-fetch-site': 'same-origin' });

    expect(response.status).toBe(204);
  });

  test('GIVEN a null Origin and a same-origin Sec-Fetch-Site WHEN posting a form THEN lets it through', async () => {
    const response = await request('POST', {
      origin: 'null',
      'sec-fetch-site': 'same-origin',
    });

    expect(response.status).toBe(204);
  });

  test.each<Record<string, string>>([{}, { 'sec-fetch-site': 'cross-site' }])(
    'GIVEN a null Origin and Sec-Fetch-Site %o WHEN posting THEN answers 403',
    async (headers) => {
      const response = await request('POST', { origin: 'null', ...headers });

      expect(response.status).toBe(403);
    },
  );

  test('GIVEN another Origin and the app origin in Sec-Fetch-Site WHEN posting THEN trusts the Origin', async () => {
    const response = await request('POST', {
      origin: 'https://evil.example',
      'sec-fetch-site': 'same-origin',
    });

    expect(response.status).toBe(403);
  });

  test('GIVEN a custom onReject WHEN rejecting THEN answers with it', async () => {
    const app = createApp(
      new CsrfGuard({
        origin: Origin,
        onReject: (c) => c.json({ error: 'cross_origin' }, 403),
      }),
    );

    const response = await request('POST', {}, app);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'cross_origin' });
  });
});

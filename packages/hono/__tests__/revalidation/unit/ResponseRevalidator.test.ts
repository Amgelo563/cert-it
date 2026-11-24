import { Hono } from 'hono';
import { describe, expect, test } from 'vite-plus/test';
import { ResponseCompressor } from '../../../src/compression/ResponseCompressor';
import { ResponseRevalidator } from '../../../src/revalidation/ResponseRevalidator';

const Large = 'x'.repeat(4096);

// one route per case, behind the compressor and the revalidator as in HttpService
function createApp(): Hono {
  const app = new Hono();
  app.use(
    ResponseCompressor.create().middleware(),
    new ResponseRevalidator({
      skip: (response) =>
        response.headers.get('content-type')?.startsWith('text/plain') ?? false,
    }).middleware(),
  );

  app.get('/page', (c) => {
    c.header('Cache-Control', 'no-cache');
    return c.html(`<p>${c.req.query('v') ?? 'a'}</p>`);
  });
  app.get('/large', (c) => {
    c.header('Cache-Control', 'no-cache');
    return c.html(Large);
  });
  app.get('/no-store', (c) => {
    c.header('Cache-Control', 'no-store');
    return c.text('ok');
  });
  app.get('/immutable', (c) => {
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    return c.text('ok');
  });
  app.get('/ranged', (c) =>
    c.body('%PDF', 200, {
      'Content-Type': 'application/pdf',
      'Accept-Ranges': 'bytes',
    }),
  );
  app.get('/skipped', (c) => {
    c.header('Cache-Control', 'no-cache');
    return c.text('skipped');
  });
  app.get('/download', (c) =>
    c.body('a,b', 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="x.csv"',
    }),
  );
  app.get('/accel', (c) =>
    c.body(null, 200, { 'X-Accel-Redirect': '/_files/1/abc.pdf' }),
  );
  app.get('/missing', (c) => c.text('missing', 404));

  return app;
}

async function request(
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return createApp().request(path, { headers });
}

describe('ResponseRevalidator (tagging)', () => {
  test('GIVEN a page WHEN requesting it THEN tags it with a strong ETag', async () => {
    const response = await request('/page');

    expect(response.headers.get('etag')).toMatch(/^"[^"]+"$/);
  });

  test('GIVEN the current ETag WHEN requesting the page again THEN answers 304 with no body and its caching headers', async () => {
    const tag = (await request('/page')).headers.get('etag') ?? '';

    const response = await request('/page', { 'if-none-match': tag });

    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
    expect(response.headers.get('etag')).toBe(tag);
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  test('GIVEN an outdated ETag WHEN the page changed THEN answers 200 with the new page', async () => {
    const tag = (await request('/page')).headers.get('etag') ?? '';

    const response = await request('/page?v=b', { 'if-none-match': tag });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<p>b</p>');
  });

  test('GIVEN a gzipped page WHEN revalidating with its weak ETag THEN answers 304 uncompressed', async () => {
    const first = await request('/large', { 'accept-encoding': 'gzip' });
    const tag = first.headers.get('etag') ?? '';

    const response = await request('/large', {
      'accept-encoding': 'gzip',
      'if-none-match': tag,
    });

    expect(first.headers.get('content-encoding')).toBe('gzip');
    expect(tag).toMatch(/^W\/"[^"]+"$/);
    expect(response.status).toBe(304);
    expect(response.headers.get('content-encoding')).toBeNull();
  });
});

describe('ResponseRevalidator (skipping)', () => {
  test.each([
    '/no-store',
    '/immutable',
    '/ranged',
    '/download',
    '/skipped',
    '/accel',
    '/missing',
  ])(
    'GIVEN the response %s WHEN requesting it THEN sends no ETag',
    async (path) => {
      const response = await request(path);

      expect(response.headers.get('etag')).toBeNull();
    },
  );

  test('GIVEN any If-None-Match WHEN requesting an X-Accel-Redirect response THEN still sends it', async () => {
    const response = await request('/accel', { 'if-none-match': '*' });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-accel-redirect')).not.toBeNull();
  });
});

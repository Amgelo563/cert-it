import { gunzipSync } from 'node:zlib';
import { Hono } from 'hono';
import { describe, expect, test } from 'vite-plus/test';
import { ResponseCompressor } from '../../../src/compression/ResponseCompressor';

const Large = 'x'.repeat(ResponseCompressor.DefaultMinBytes * 4);

// one route per case, behind the compressor
function createApp(): Hono {
  const app = new Hono();
  app.use(
    new ResponseCompressor({
      skip: (response) => response.headers.has('X-Skip'),
    }).middleware(),
  );

  app.get('/html', (c) => c.html(`<p>${Large}</p>`));
  app.get('/json', (c) => c.json({ value: Large }));
  app.get('/tiny', (c) => c.html('<p>hi</p>'));
  app.get('/pdf', (c) =>
    c.body(Large, 200, { 'Content-Type': 'application/pdf' }),
  );
  app.get('/accel', (c) =>
    c.body(null, 200, {
      'Content-Type': 'application/pdf',
      'X-Accel-Redirect': '/_files/1/abc.pdf',
    }),
  );
  app.get('/accel-html', (c) =>
    c.html(Large, 200, { 'X-Accel-Redirect': '/_files/1/abc.html' }),
  );
  app.get('/precompressed', (c) =>
    c.body(Large, 200, {
      'Content-Type': 'text/javascript',
      'Content-Encoding': 'br',
    }),
  );
  app.get('/download', (c) =>
    c.html(Large, 200, { 'Content-Disposition': 'attachment' }),
  );
  app.get('/ranged', (c) => c.html(Large, 200, { 'Accept-Ranges': 'bytes' }));
  app.get('/skipped', (c) => c.html(Large, 200, { 'X-Skip': '1' }));
  app.get('/partial', (c) =>
    c.body(Large, 206, { 'Content-Type': 'text/plain' }),
  );

  return app;
}

async function request(
  path: string,
  acceptEncoding = 'gzip, deflate, br',
): Promise<Response> {
  return createApp().request(path, {
    headers: { 'accept-encoding': acceptEncoding },
  });
}

describe('ResponseCompressor (compressing)', () => {
  test.each(['/html', '/json'])(
    'GIVEN a large dynamic response %s WHEN the browser accepts gzip THEN sends it gzipped',
    async (path) => {
      const plain = await (await request(path, 'identity')).text();
      const response = await request(path);
      const body = Buffer.from(await response.arrayBuffer());

      expect(response.headers.get('content-encoding')).toBe('gzip');
      expect(response.headers.get('vary')).toBe('Accept-Encoding');
      expect(response.headers.get('content-length')).toBeNull();
      expect(gunzipSync(body).toString()).toBe(plain);
    },
  );

  test('GIVEN a browser that only accepts deflate WHEN requesting a page THEN sends it deflated', async () => {
    const response = await request('/html', 'deflate');

    expect(response.headers.get('content-encoding')).toBe('deflate');
  });

  test('GIVEN a browser that accepts no encoding WHEN requesting a page THEN sends it plain with Vary', async () => {
    const response = await request('/html', 'identity');

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('vary')).toBe('Accept-Encoding');
    expect(await response.text()).toBe(`<p>${Large}</p>`);
  });
});

describe('ResponseCompressor (skipping)', () => {
  test('GIVEN a response under the minimum size WHEN requesting it THEN sends it plain with its length', async () => {
    const response = await request('/tiny');

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('vary')).toBeNull();
    expect(response.headers.get('content-length')).toBe('9');
    expect(await response.text()).toBe('<p>hi</p>');
  });

  test('GIVEN a PDF WHEN requesting it THEN sends it plain', async () => {
    const response = await request('/pdf');

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(await response.text()).toBe(Large);
  });

  test.each(['/accel', '/accel-html', '/download', '/ranged', '/skipped'])(
    'GIVEN a file or skipped response %s WHEN requesting it THEN leaves it untouched',
    async (path) => {
      const response = await request(path);

      expect(response.headers.get('content-encoding')).toBeNull();
      expect(response.headers.get('vary')).toBeNull();
    },
  );

  test('GIVEN an already compressed response WHEN requesting it THEN keeps its encoding', async () => {
    const response = await request('/precompressed');

    expect(response.headers.get('content-encoding')).toBe('br');
    expect(await response.text()).toBe(Large);
  });

  test('GIVEN a partial response WHEN requesting it THEN sends it plain', async () => {
    const response = await request('/partial');

    expect(response.status).toBe(206);
    expect(response.headers.get('content-encoding')).toBeNull();
  });

  test('GIVEN a HEAD request WHEN requesting a page THEN sends no encoding', async () => {
    const response = await createApp().request('/html', {
      method: 'HEAD',
      headers: { 'accept-encoding': 'gzip' },
    });

    expect(response.headers.get('content-encoding')).toBeNull();
  });
});

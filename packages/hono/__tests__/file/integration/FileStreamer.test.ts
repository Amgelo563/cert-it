import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DoesntExistFileError } from '@cert-it/shared';
import type { Result } from 'better-result';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test';
import { FileStreamer } from '../../../src/file/FileStreamer';

const Content = '0123456789';

let directory: string;

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'hono-files-'));
  writeFileSync(join(directory, 'file.txt'), Content);
  writeFileSync(join(directory, 'empty.txt'), '');
  mkdirSync(join(directory, 'folder'));
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

// the streamer's result, from inside a route
async function send(
  name: string,
  headers: Record<string, string> = {},
  method = 'GET',
): Promise<Result<Response, unknown>> {
  let result: Result<Response, unknown> | null = null;
  const app = new Hono();
  app.on(['GET', 'HEAD'], '/', async (c) => {
    result = await FileStreamer.Instance.send(c, join(directory, name), {
      'Content-Type': 'text/plain',
    });
    return result.isOk() ? result.value : c.body(null, 500);
  });

  await app.request('/', { method, headers });
  return result!;
}

async function serve(
  headers: Record<string, string> = {},
  method = 'GET',
): Promise<Response> {
  return (await send('file.txt', headers, method)).unwrap();
}

describe('FileStreamer (whole file)', () => {
  test('GIVEN no Range WHEN sending THEN sends the whole file with the given headers and advertises ranges', async () => {
    const response = await serve();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(response.headers.get('content-length')).toBe('10');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(await response.text()).toBe(Content);
  });

  test('GIVEN a HEAD request with a Range WHEN sending THEN ignores the range and sends no body', async () => {
    const response = await serve({ Range: 'bytes=0-1' }, 'HEAD');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('10');
    expect(response.body).toBeNull();
  });

  test('GIVEN an empty file WHEN sending THEN sends no body with a zero length', async () => {
    const response = (await send('empty.txt')).unwrap();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('0');
    expect(response.body).toBeNull();
  });
});

describe('FileStreamer (Range)', () => {
  test.each([
    { range: 'bytes=2-5', contentRange: 'bytes 2-5/10', body: '2345' },
    { range: 'bytes=7-', contentRange: 'bytes 7-9/10', body: '789' },
    { range: 'bytes=-3', contentRange: 'bytes 7-9/10', body: '789' },
    { range: 'bytes=-50', contentRange: 'bytes 0-9/10', body: Content },
    { range: 'bytes=8-99', contentRange: 'bytes 8-9/10', body: '89' },
  ])(
    'GIVEN Range $range WHEN sending THEN sends 206 with $contentRange',
    async ({ range, contentRange, body }) => {
      const response = await serve({ Range: range });

      expect(response.status).toBe(206);
      expect(response.headers.get('content-range')).toBe(contentRange);
      expect(response.headers.get('content-length')).toBe(String(body.length));
      expect(await response.text()).toBe(body);
    },
  );

  test.each(['bytes=10-', 'bytes=10-20', 'bytes=-0'])(
    'GIVEN Range %s past the end WHEN sending THEN sends 416 with the size',
    async (range) => {
      const response = await serve({ Range: range });

      expect(response.status).toBe(416);
      expect(response.headers.get('content-range')).toBe('bytes */10');
    },
  );

  test.each(['bytes=0-1,4-5', 'bytes=5-2', 'items=0-1', 'bytes=-', 'nonsense'])(
    'GIVEN Range %s it does not support WHEN sending THEN sends the whole file',
    async (range) => {
      const response = await serve({ Range: range });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(Content);
    },
  );
});

describe('FileStreamer (errors)', () => {
  test.each(['missing.txt', join('file.txt', 'inner'), 'folder'])(
    'GIVEN the path %s that is not a file WHEN sending THEN returns a DoesntExistFileError',
    async (name) => {
      const result = await send(name);

      expect(result.isErr() && DoesntExistFileError.is(result.error)).toBe(
        true,
      );
    },
  );
});

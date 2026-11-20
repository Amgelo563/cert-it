import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { UploadReader } from '../../../../src/http/upload/UploadReader';

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cert-it-upload-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

// streamed in chunks and without a Content-Length, as a chunked upload arrives
function streamed(...chunks: string[]): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request('https://example.org/', {
    method: 'POST',
    body,
    duplex: 'half',
  } as RequestInit);
}

describe('UploadReader (readBytes)', () => {
  test('GIVEN a body within the limit WHEN reading THEN returns all of it', async () => {
    const result = await new UploadReader({ maxBytes: 10 }).readBytes(
      streamed('abc', 'def'),
    );

    expect(new TextDecoder().decode(result.unwrap())).toBe('abcdef');
  });

  test('GIVEN a streamed body over the limit WHEN reading THEN fails', async () => {
    const result = await new UploadReader({ maxBytes: 5 }).readBytes(
      streamed('abc', 'def'),
    );

    expect(result.isErr()).toBe(true);
  });

  test('GIVEN a declared length over the limit WHEN reading THEN fails', async () => {
    const request = new Request('https://example.org/', {
      method: 'POST',
      body: 'abcdef',
    });

    const result = await new UploadReader({ maxBytes: 5 }).readBytes(request);

    expect(result.isErr()).toBe(true);
  });
});

describe('UploadReader (saveToFile)', () => {
  test('GIVEN a body within the limit WHEN saving THEN writes it and answers its size and hash', async () => {
    const path = join(directory, 'upload');

    const result = await new UploadReader({ maxBytes: 10 }).saveToFile(
      streamed('abc', 'def'),
      path,
    );

    expect(result.unwrap()).toEqual({
      bytes: 6,
      sha256: createHash('sha256').update('abcdef').digest('hex'),
    });
    expect(readFileSync(path, 'utf8')).toBe('abcdef');
  });

  test('GIVEN a streamed body over the limit WHEN saving THEN fails and leaves no file', async () => {
    const path = join(directory, 'upload');

    const result = await new UploadReader({ maxBytes: 5 }).saveToFile(
      streamed('abc', 'def'),
      path,
    );

    expect(result.isErr()).toBe(true);
    expect(existsSync(path)).toBe(false);
  });
});

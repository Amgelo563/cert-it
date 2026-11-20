import { type FileHandle, open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { DoesntExistFileError, FileSystemError } from '@cert-it/shared';
import { Result } from 'better-result';
import type { Context } from 'hono';

/** A byte range to send, with both ends included, or a range that lies past the end of the file. */
type ByteRange =
  | { satisfiable: true; start: number; end: number }
  | { satisfiable: false };

/** Sends files from disk, with single-range Range support. */
export class FileStreamer {
  public static readonly Instance = new FileStreamer();

  protected static readonly RangePattern = /^bytes=(\d*)-(\d*)$/;

  /**
   * Returns a response that sends the file at the given path with the given headers, plus Accept-Ranges, Content-Length and Content-Range.
   *
   * A single satisfiable range gets 206, an unsatisfiable one 416, and HEAD gets the headers only.
   */
  public async send(
    c: Context,
    path: string,
    headers?: HeadersInit,
  ): Promise<Result<Response, DoesntExistFileError | FileSystemError>> {
    let handle: FileHandle;
    try {
      handle = await open(path);
    } catch (error) {
      return Result.err(this.toError(path, error));
    }

    // size and content come from the same open file: an atomic replace can't mix two versions
    let streaming = false;
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) {
        return Result.err(new DoesntExistFileError({ path }));
      }

      const response = this.createResponse(c, handle, stat.size, headers);
      streaming = response.body !== null;
      return Result.ok(response);
    } catch (error) {
      return Result.err(this.toError(path, error));
    } finally {
      if (!streaming) await handle.close();
    }
  }

  protected createResponse(
    c: Context,
    handle: FileHandle,
    size: number,
    init?: HeadersInit,
  ): Response {
    const headers = new Headers(init);
    headers.set('Accept-Ranges', 'bytes');

    const { method } = c.req;
    const range =
      method === 'GET'
        ? this.parseRange(c.req.header('Range') ?? null, size)
        : null;

    if (range && !range.satisfiable) {
      headers.set('Content-Range', `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }

    const start = range ? range.start : 0;
    const end = range ? range.end : size - 1;
    headers.set('Content-Length', String(end - start + 1));
    if (range) headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    const status = range ? 206 : 200;

    if (method === 'HEAD' || size === 0) {
      return new Response(null, { status, headers });
    }

    const body = Readable.toWeb(
      handle.createReadStream({ start, end, autoClose: true }),
    ) as ReadableStream<Uint8Array>;
    return new Response(body, { status, headers });
  }

  // one range only: multiple ranges, other units and malformed headers get the whole file, as RFC 9110 allows
  protected parseRange(header: string | null, size: number): ByteRange | null {
    const match = header?.trim().match(FileStreamer.RangePattern);
    if (!match) return null;

    const [, first = '', last = ''] = match;
    if (first === '' && last === '') return null;

    if (first === '') {
      const suffix = Number(last);
      if (suffix === 0 || size === 0) return { satisfiable: false };
      return {
        satisfiable: true,
        start: Math.max(0, size - suffix),
        end: size - 1,
      };
    }

    const start = Number(first);
    const end = last === '' ? Infinity : Number(last);
    if (end < start) return null;
    if (start >= size) return { satisfiable: false };

    return { satisfiable: true, start, end: Math.min(end, size - 1) };
  }

  protected toError(
    path: string,
    error: unknown,
  ): DoesntExistFileError | FileSystemError {
    if (DoesntExistFileError.matches(error)) {
      return new DoesntExistFileError({ path });
    }

    const cause = error instanceof Error ? error : new Error(String(error));
    return new FileSystemError({ path, message: cause.message, cause });
  }
}

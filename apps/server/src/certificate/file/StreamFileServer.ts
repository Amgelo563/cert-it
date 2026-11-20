import { open } from 'node:fs/promises';
import { DoesntExistFileError } from '@cert-it/file';
import { Readable } from 'node:stream';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import { AbstractFileServer } from './AbstractFileServer';
import { CertificateFileNotFoundError } from './errors/CertificateFileNotFoundError';
import type { ServedFile } from './FileServer';

type StreamFileServerOptions = {
  dataDirectory: DataDirectoryService;
};

/** A byte range to send, with both ends included, or a range that lies past the end of the file. */
type ByteRange =
  | { satisfiable: true; start: number; end: number }
  | { satisfiable: false };

/** Sends PDFs from the app itself, with single-range `Range` support for the pdf.js preview (`files.serve: stream`). */
export class StreamFileServer extends AbstractFileServer {
  protected static readonly RangePattern = /^bytes=(\d*)-(\d*)$/;

  protected readonly dataDirectory: DataDirectoryService;

  constructor(options: StreamFileServerOptions) {
    super();
    this.dataDirectory = options.dataDirectory;
  }

  public override async serve(
    request: Request,
    file: ServedFile,
  ): Promise<Response> {
    const path = this.dataDirectory.getCertificatePath(
      file.courseId,
      file.code,
    );
    const handle = await open(path).catch((error: unknown) => {
      throw DoesntExistFileError.matches(error)
        ? new CertificateFileNotFoundError(file.code, { cause: error })
        : error;
    });

    // size and content come from the same open file: an atomic replace can't mix two versions
    let streaming = false;
    try {
      const { size } = await handle.stat();
      const headers = this.createHeaders(file);
      headers.set('Accept-Ranges', 'bytes');

      const range =
        request.method === 'GET'
          ? this.parseRange(request.headers.get('Range'), size)
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

      if (request.method === 'HEAD' || size === 0) {
        return new Response(null, { status, headers });
      }

      const body = Readable.toWeb(
        handle.createReadStream({ start, end, autoClose: true }),
      ) as ReadableStream<Uint8Array>;
      streaming = true;
      return new Response(body, { status, headers });
    } finally {
      if (!streaming) await handle.close();
    }
  }

  // one range only: multiple ranges, other units and malformed headers get the whole file, as RFC 9110 allows
  protected parseRange(header: string | null, size: number): ByteRange | null {
    const match = header?.trim().match(StreamFileServer.RangePattern);
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
}

import { createHash } from 'node:crypto';
import { open, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Result } from 'better-result';
import { UploadTooLargeError } from './UploadTooLargeError';

type UploadReaderOptions = {
  maxBytes: number;
};

/** A file saved by {@link UploadReader.saveToFile}. */
export type SavedUpload = {
  bytes: number;
  /** Hex SHA-256 of the contents. */
  sha256: string;
};

/** Reads the raw body of a file upload, stopping as soon as it goes over the size limit. */
export class UploadReader {
  protected readonly maxBytes: number;

  constructor(options: UploadReaderOptions) {
    this.maxBytes = options.maxBytes;
  }

  /** Returns the size limit in bytes. */
  public getMaxBytes(): number {
    return this.maxBytes;
  }

  /** Reads the whole body into memory. An empty body gives empty bytes. */
  public async readBytes(
    request: Request,
  ): Promise<Result<Uint8Array, UploadTooLargeError>> {
    if (this.declaresTooMuch(request)) return this.tooLarge();

    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of this.chunks(request)) {
      total += chunk.byteLength;
      if (total > this.maxBytes) return this.tooLarge();
      chunks.push(chunk);
    }

    return Result.ok(Buffer.concat(chunks, total));
  }

  /**
   * Streams the body to a file, hashing it on the way. A failed or too large upload leaves no file behind.
   *
   * @throws {Error} If the file can't be written or the body can't be read.
   */
  public async saveToFile(
    request: Request,
    path: string,
  ): Promise<Result<SavedUpload, UploadTooLargeError>> {
    if (this.declaresTooMuch(request)) return this.tooLarge();

    const hash = createHash('sha256');
    let total = 0;
    const limited = async function* (
      this: UploadReader,
    ): AsyncGenerator<Uint8Array> {
      for await (const chunk of this.chunks(request)) {
        total += chunk.byteLength;
        if (total > this.maxBytes) {
          throw new UploadTooLargeError({ maxBytes: this.maxBytes });
        }
        hash.update(chunk);
        yield chunk;
      }
    }.call(this);

    // opened up front, so a failure can't race the stream's own open and leave an empty file
    const handle = await open(path, 'w');
    try {
      await pipeline(limited, handle.createWriteStream());
    } catch (error) {
      await handle.close().catch(() => {});
      await rm(path, { force: true });
      if (UploadTooLargeError.is(error)) return Result.err(error);
      throw error;
    }

    return Result.ok({ bytes: total, sha256: hash.digest('hex') });
  }

  // a declared length over the limit is refused before reading anything
  protected declaresTooMuch(request: Request): boolean {
    const length = Number(request.headers.get('Content-Length'));
    return Number.isFinite(length) && length > this.maxBytes;
  }

  protected async *chunks(request: Request): AsyncGenerator<Uint8Array> {
    if (!request.body) return;
    for await (const chunk of request.body) yield chunk;
  }

  protected tooLarge(): Result<never, UploadTooLargeError> {
    return Result.err(new UploadTooLargeError({ maxBytes: this.maxBytes }));
  }
}

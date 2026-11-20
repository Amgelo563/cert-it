import type { Context, MiddlewareHandler, Next } from 'hono';
import { compress, COMPRESSIBLE_CONTENT_TYPE_REGEX } from 'hono/compress';
import { isFileResponse } from '../util/isFileResponse';

type ResponseCompressorOptions = {
  /** @default ResponseCompressor.DefaultMinBytes */
  minBytes?: number;
  /** Extra responses to leave uncompressed, on top of file responses. */
  skip?: (response: Response) => boolean;
};

/** Compresses dynamic responses (pages, JSON) with gzip or deflate, skipping file responses and the ones it shouldn't touch. */
export class ResponseCompressor {
  public static readonly DefaultMinBytes = 1024;

  protected static readonly NoNext: Next = () => Promise.resolve();

  protected readonly minBytes: number;

  protected readonly skip: (response: Response) => boolean;

  constructor(options: ResponseCompressorOptions = {}) {
    this.minBytes = options.minBytes ?? ResponseCompressor.DefaultMinBytes;
    this.skip = options.skip ?? (() => false);
  }

  /** Returns the middleware. */
  public middleware(): MiddlewareHandler {
    const compressor = compress({
      threshold: this.minBytes,
      contentTypeFilter: (type) => COMPRESSIBLE_CONTENT_TYPE_REGEX.test(type),
    });

    return async (c, next) => {
      await next();
      if (isFileResponse(c.res) || this.skip(c.res)) return;

      await this.measure(c);
      await compressor(c, ResponseCompressor.NoNext);
    };
  }

  // a known length lets the compressor skip bodies under the minimum
  protected async measure(c: Context): Promise<void> {
    const { res } = c;
    const type = res.headers.get('Content-Type');
    if (
      !res.body
      || c.req.method === 'HEAD'
      || res.headers.has('Content-Length')
      || res.headers.has('Content-Encoding')
      || !type
      || !COMPRESSIBLE_CONTENT_TYPE_REGEX.test(type)
    ) {
      return;
    }

    const body = await res.arrayBuffer();
    c.res = new Response(body, res);
    c.res.headers.set('Content-Length', body.byteLength.toString());
  }
}

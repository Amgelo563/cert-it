import type { Context, MiddlewareHandler, Next } from 'hono';
import { compress, COMPRESSIBLE_CONTENT_TYPE_REGEX } from 'hono/compress';

/** Compresses dynamic responses (pages, JSON) with gzip or deflate, skipping the ones it shouldn't touch. */
export class ResponseCompressor {
  public static readonly MinBytes = 1024;

  // sent with an empty body; nginx serves the file
  protected static readonly XAccelRedirectHeader = 'X-Accel-Redirect';

  protected static readonly SkippedContentType = /^\s*application\/pdf\b/i;

  protected static readonly NoNext: Next = () => Promise.resolve();

  /** Returns the middleware. */
  public middleware(): MiddlewareHandler {
    const compressor = compress({
      threshold: ResponseCompressor.MinBytes,
      contentTypeFilter: (type) => this.isCompressible(type),
    });

    return async (c, next) => {
      await next();
      if (c.res.headers.has(ResponseCompressor.XAccelRedirectHeader)) return;

      await this.measure(c);
      await compressor(c, ResponseCompressor.NoNext);
    };
  }

  protected isCompressible(type: string): boolean {
    return (
      !ResponseCompressor.SkippedContentType.test(type)
      && COMPRESSIBLE_CONTENT_TYPE_REGEX.test(type)
    );
  }

  protected async measure(c: Context): Promise<void> {
    const { res } = c;
    const type = res.headers.get('Content-Type');
    if (
      !res.body
      || c.req.method === 'HEAD'
      || res.headers.has('Content-Length')
      || res.headers.has('Content-Encoding')
      || !type
      || !this.isCompressible(type)
    ) {
      return;
    }

    const body = await res.arrayBuffer();
    c.res = new Response(body, res);
    c.res.headers.set('Content-Length', body.byteLength.toString());
  }
}

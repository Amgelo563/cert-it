import type { MiddlewareHandler, Next } from 'hono';
import { etag } from 'hono/etag';

/** Tags responses with an ETag and answers 304 when the browser's copy is still current, so `no-cache` responses cost little to revalidate. */
export class ResponseRevalidator {
  protected static readonly XAccelRedirectHeader = 'X-Accel-Redirect';

  protected static readonly DownloadContentType = /^\s*application\/pdf\b/i;

  protected static readonly UncachedOrImmutable =
    /(?:^|,)\s*(?:no-store|immutable)\s*(?:,|$)/i;

  protected static readonly NoNext: Next = () => Promise.resolve();

  /** Returns the middleware. */
  public middleware(): MiddlewareHandler {
    const tagger = etag();

    return async (c, next) => {
      await next();
      if (!this.shouldTag(c.res)) return;

      await tagger(c, ResponseRevalidator.NoNext);
    };
  }

  protected shouldTag(res: Response): boolean {
    const { headers } = res;

    return (
      res.status === 200
      && !headers.has(ResponseRevalidator.XAccelRedirectHeader)
      && !headers.has('Content-Disposition')
      && !ResponseRevalidator.DownloadContentType.test(
        headers.get('Content-Type') ?? '',
      )
      && !ResponseRevalidator.UncachedOrImmutable.test(
        headers.get('Cache-Control') ?? '',
      )
    );
  }
}

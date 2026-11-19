import type { MiddlewareHandler } from 'hono';
import type { HttpEnv } from '../../http/HttpEnv';
import type { SiteUrl } from '../../http/url/SiteUrl';

type CsrfGuardOptions = {
  siteUrl: SiteUrl;
};

/** Rejects state-changing requests from other origins, on top of the SameSite cookie. */
export class CsrfGuard {
  public static readonly ForbiddenCode = 'cross_origin';

  protected static readonly SafeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  protected readonly origin: string;

  constructor(options: CsrfGuardOptions) {
    // from base_url only, never from Host or X-Forwarded headers
    this.origin = options.siteUrl.getOrigin();
  }

  /** Answers 403 to unsafe methods whose Origin isn't the app's, or that send neither Origin nor Sec-Fetch-Site. */
  public middleware(): MiddlewareHandler<HttpEnv> {
    return async (c, next) => {
      if (
        CsrfGuard.SafeMethods.has(c.req.method)
        || this.isSameOrigin(c.req.raw.headers)
      ) {
        await next();
        return;
      }

      c.header('Cache-Control', 'no-store');
      return c.json({ error: CsrfGuard.ForbiddenCode }, 403);
    };
  }

  protected isSameOrigin(headers: Headers): boolean {
    const origin = headers.get('origin');
    if (origin) return origin === this.origin;

    // browsers that omit Origin still send this on fetches
    return headers.get('sec-fetch-site') === 'same-origin';
  }
}

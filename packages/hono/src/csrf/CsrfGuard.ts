import type { Context, MiddlewareHandler } from 'hono';

type CsrfGuardOptions = {
  /** Origin the app is served from, such as SiteUrl.getOrigin(). Never derive it from Host or X-Forwarded headers. */
  origin: string;
  /** @default CsrfGuard.DefaultOnReject */
  onReject?: (c: Context) => Response | Promise<Response>;
};

/** Rejects state-changing requests from other origins, on top of the SameSite cookie. */
export class CsrfGuard {
  /** Answers a plain 403 Forbidden. */
  public static readonly DefaultOnReject = (c: Context): Response =>
    c.text('Forbidden', 403);

  protected static readonly SafeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  protected readonly origin: string;

  protected readonly onReject: (c: Context) => Response | Promise<Response>;

  constructor(options: CsrfGuardOptions) {
    this.origin = options.origin;
    this.onReject = options.onReject ?? CsrfGuard.DefaultOnReject;
  }

  /** Returns the middleware that answers unsafe methods whose Origin isn't the app's, or that send no Origin (or `null`) and no same-origin Sec-Fetch-Site, with onReject. */
  public middleware(): MiddlewareHandler {
    return async (c, next) => {
      if (
        CsrfGuard.SafeMethods.has(c.req.method)
        || this.isSameOrigin(c.req.raw.headers)
      ) {
        return next();
      }

      return this.onReject(c);
    };
  }

  protected isSameOrigin(headers: Headers): boolean {
    const origin = headers.get('origin');
    // form posts send "null" under Referrer-Policy: no-referrer, even to the same origin
    if (origin && origin !== 'null') return origin === this.origin;

    // browsers that omit Origin still send this on fetches and form posts
    return headers.get('sec-fetch-site') === 'same-origin';
  }
}

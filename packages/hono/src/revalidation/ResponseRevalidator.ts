import type { MiddlewareHandler, Next } from 'hono';
import { etag } from 'hono/etag';
import { isFileResponse } from '../util/isFileResponse';

type ResponseRevalidatorOptions = {
  /** Extra responses to leave untagged, on top of file, no-store and immutable responses. */
  skip?: (response: Response) => boolean;
};

/** Tags responses with an ETag and answers 304 when the browser's copy is still current, so `no-cache` responses cost little to revalidate. */
export class ResponseRevalidator {
  protected static readonly UncachedOrImmutable =
    /(?:^|,)\s*(?:no-store|immutable)\s*(?:,|$)/i;

  protected static readonly NoNext: Next = () => Promise.resolve();

  protected readonly skip: (response: Response) => boolean;

  constructor(options: ResponseRevalidatorOptions) {
    this.skip = options.skip ?? (() => false);
  }

  public static create(options?: {
    injections?: Partial<ResponseRevalidatorOptions>;
  }): ResponseRevalidator {
    return new ResponseRevalidator({ ...options?.injections });
  }

  /** Returns the middleware. */
  public middleware(): MiddlewareHandler {
    const tagger = etag();

    return async (c, next) => {
      await next();
      if (!this.shouldTag(c.res)) return;

      await tagger(c, ResponseRevalidator.NoNext);
    };
  }

  // etag reads the whole body to hash it, so a streamed file would be loaded into memory
  protected shouldTag(res: Response): boolean {
    return (
      res.status === 200
      && !isFileResponse(res)
      && !this.skip(res)
      && !ResponseRevalidator.UncachedOrImmutable.test(
        res.headers.get('Cache-Control') ?? '',
      )
    );
  }
}

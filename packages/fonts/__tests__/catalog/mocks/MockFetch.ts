type Handler = (
  url: string,
  init?: RequestInit,
) => Response | Promise<Response>;

/** A fetch that answers from handlers matched by URL prefix, newest first, and records the URLs it was called with. */
export class MockFetch {
  public readonly calls: string[] = [];

  protected readonly routes: [string, Handler][] = [];

  public readonly fetch: typeof fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    this.calls.push(url);

    const route = this.routes.find(([prefix]) => url.startsWith(prefix));
    if (!route) return Promise.resolve(new Response(null, { status: 404 }));

    return Promise.resolve(route[1](url, init));
  };

  /** Answers URLs starting with the prefix, before any handler added earlier. */
  public on(prefix: string, handler: Handler): this {
    this.routes.unshift([prefix, handler]);
    return this;
  }

  /** Returns the number of calls whose URL starts with the prefix. */
  public count(prefix: string): number {
    return this.calls.filter((url) => url.startsWith(prefix)).length;
  }
}

/** A handler that never answers, and fails once the request's signal aborts. */
export const NeverAnswers: Handler = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(init.signal?.reason as Error),
    );
  });

/** A handler that sends the bytes as a stream without Content-Length. */
export function streamed(bytes: Uint8Array): Handler {
  return () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
    );
}

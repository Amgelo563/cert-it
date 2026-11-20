import type { CertItApi } from '@cert-it/server/api';
import { type ApiErrorCode, ApiErrorCodeEnum } from '@cert-it/shared';
import { type ClientResponse, hc } from 'hono/client';
import type { SuccessStatusCode } from 'hono/utils/http-status';
import { ApiRequestError } from './errors/ApiRequestError';

/** The API routes, typed from the server's, such as `routes.auth.me.$get()`. */
export type ApiRoutes = ReturnType<typeof hc<CertItApi>>['api'];

/** The body of a route's successful answers, or undefined for answers without JSON. */
export type ApiSuccess<R> =
  R extends ClientResponse<infer Body, infer Status, infer Format>
    ? Status extends SuccessStatusCode
      ? Format extends 'json'
        ? Body
        : undefined
      : never
    : never;

type ApiClientOptions = {
  /** URL the panel is served under, such as `https://example.org/certs/`. */
  baseUrl: URL;
  fetch: typeof fetch;
};

/** Called with each failed request, such as to send logged-out users to login. */
export type ApiErrorListener = (error: ApiRequestError) => void;

/** Sends requests to the server's API, typed end to end, with the session cookie. */
export class ApiClient {
  // the panel is served at {base}/admin/ and the API routes at {base}/api/
  protected static readonly SitePath = '../';

  protected static readonly Codes: ReadonlySet<string> = new Set(
    Object.values(ApiErrorCodeEnum),
  );

  protected readonly routes: ApiRoutes;

  protected readonly listeners = new Set<ApiErrorListener>();

  constructor(options: ApiClientOptions) {
    this.routes = hc<CertItApi>(options.baseUrl.href, {
      fetch: options.fetch,
      init: { credentials: 'same-origin' },
    }).api;
  }

  public static create(options?: {
    injections?: Partial<ApiClientOptions>;
  }): ApiClient {
    return new ApiClient({
      baseUrl:
        options?.injections?.baseUrl
        ?? new URL(ApiClient.SitePath, document.baseURI),
      fetch: options?.injections?.fetch ?? globalThis.fetch.bind(globalThis),
    });
  }

  /**
   * Sends the request built from the routes, returning the body of its successful answer.
   *
   * @throws {ApiRequestError} If the request fails or the answer isn't successful.
   * @example const user = await api.request((routes) => routes.auth.me.$get());
   */
  public async request<R extends ClientResponse<any, any, any>>(
    send: (routes: ApiRoutes) => Promise<R>,
  ): Promise<ApiSuccess<R>> {
    let response: R;
    try {
      response = await send(this.routes);
    } catch (cause) {
      throw this.fail(new ApiRequestError({ status: 0, code: null, cause }));
    }

    if (!response.ok) throw this.fail(await this.toError(response));
    // ApiSuccess maps answers without JSON, such as 204, to undefined
    if (response.status === 204) return undefined as ApiSuccess<R>;
    return (await response.json()) as ApiSuccess<R>;
  }

  /**
   * Sends the request built from the routes, returning the bytes of its successful answer, such as a font or PDF.
   *
   * @throws {ApiRequestError} If the request fails or the answer isn't successful.
   */
  public async requestBytes(
    send: (routes: ApiRoutes) => Promise<ClientResponse<unknown>>,
  ): Promise<ArrayBuffer> {
    let response: ClientResponse<unknown>;
    try {
      response = await send(this.routes);
    } catch (cause) {
      throw this.fail(new ApiRequestError({ status: 0, code: null, cause }));
    }

    if (!response.ok) throw this.fail(await this.toError(response));
    try {
      return await response.arrayBuffer();
    } catch (cause) {
      throw this.fail(new ApiRequestError({ status: 0, code: null, cause }));
    }
  }

  /** Adds a listener for failed requests, returning a function that removes it. */
  public onError(listener: ApiErrorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected async toError(
    response: ClientResponse<unknown>,
  ): Promise<ApiRequestError> {
    const retryAfter = Number(response.headers.get('retry-after'));

    return new ApiRequestError({
      status: response.status,
      code: await this.readCode(response),
      retryAfterSeconds:
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    });
  }

  // a proxy in front may answer with HTML or nothing
  protected async readCode(
    response: ClientResponse<unknown>,
  ): Promise<ApiErrorCode | null> {
    try {
      const body: unknown = await response.json();
      const code =
        typeof body === 'object' && body !== null && 'error' in body
          ? body.error
          : null;
      return typeof code === 'string' && ApiClient.Codes.has(code)
        ? (code as ApiErrorCode)
        : null;
    } catch {
      return null;
    }
  }

  protected fail(error: ApiRequestError): ApiRequestError {
    for (const listener of this.listeners) listener(error);
    return error;
  }
}

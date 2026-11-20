import type { ClientResponse } from 'hono/client';
import { useCallback, useEffect, useState } from 'react';
import type { ApiRoutes, ApiSuccess } from './ApiClient';
import { useApiClient } from './useApiClient';

/** The state of a request made with useApiRequest. */
export type ApiRequestState<T> = {
  /** The last successful answer, kept while the next one loads. */
  data: T | undefined;
  /** The last request's error, or null. */
  error: unknown;
  loading: boolean;
  /** Sends the request again, such as after a change. */
  reload: () => void;
};

type Settled<T> = {
  /** The request this answer is for, to tell when a newer one is loading. */
  send: unknown;
  version: number;
  data: T | undefined;
  error: unknown;
};

/**
 * Sends a request when the component mounts and again whenever `send` changes, ignoring answers that arrive after a newer request.
 *
 * @param send The request, wrapped in useCallback with what it depends on, such as the page number.
 */
export function useApiRequest<R extends ClientResponse<any, any, any>>(
  send: (routes: ApiRoutes) => Promise<R>,
): ApiRequestState<ApiSuccess<R>> {
  const api = useApiClient();
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<ApiSuccess<R>>>({
    send: null,
    version: 0,
    data: undefined,
    error: null,
  });

  useEffect(() => {
    let current = true;

    api.request(send).then(
      (data) => {
        if (current) setSettled({ send, version, data, error: null });
      },
      (error: unknown) => {
        if (current) {
          setSettled((previous) => ({ ...previous, send, version, error }));
        }
      },
    );

    return () => {
      current = false;
    };
  }, [api, send, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return {
    data: settled.data,
    error: settled.error,
    loading: settled.send !== send || settled.version !== version,
    reload,
  };
}

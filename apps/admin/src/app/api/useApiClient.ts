import { useContext } from 'react';
import type { ApiClient } from './ApiClient';
import { ApiClientContext } from './ApiClientContext';

/** Returns the panel's API client. */
export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) throw new Error('useApiClient needs an ApiClientContext');
  return client;
}

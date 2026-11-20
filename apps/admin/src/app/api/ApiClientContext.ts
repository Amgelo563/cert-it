import { createContext } from 'react';
import type { ApiClient } from './ApiClient';

/** The API client of the panel, read with useApiClient. */
export const ApiClientContext = createContext<ApiClient | null>(null);

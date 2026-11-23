import type { ApiService } from './ApiService';

/** The API routes, relative to the base path, for `hc<CertItApi>()` in the admin panel. */
export type CertItApi = ReturnType<ApiService['getApp']>;

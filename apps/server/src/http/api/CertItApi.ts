import type { HttpService } from '../HttpService';

/** The API routes, relative to the base path, for `hc<CertItApi>()` in the admin panel. */
export type CertItApi = ReturnType<HttpService['getApi']>;

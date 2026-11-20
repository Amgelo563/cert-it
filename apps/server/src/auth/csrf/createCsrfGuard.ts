import { CsrfGuard, type SiteUrl } from '@cert-it/hono';
import { ApiErrorCodeEnum } from '@cert-it/shared';
import { apiError } from '../../http/api/apiError';

/** Returns the guard that answers cross-origin API writes with the cross_origin error. */
export function createCsrfGuard(siteUrl: SiteUrl): CsrfGuard {
  return new CsrfGuard({
    // from base_url only, never from Host or X-Forwarded headers
    origin: siteUrl.getOrigin(),
    onReject: (c) => apiError(c, 403, ApiErrorCodeEnum.CrossOrigin),
  });
}

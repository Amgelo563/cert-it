import { fileURLToPath } from 'node:url';
import { CsrfGuard, RateLimiter, type SiteUrl } from '@cert-it/hono';
import { LocaleEnum } from '@cert-it/shared';
import { LookupPageService } from '../../../src/certificate/lookup/LookupPageService';
import { CertificatePageService } from '../../../src/certificate/page/CertificatePageService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { LocaleResolver } from '../../../src/i18n/LocaleResolver';
import { PublicAssetsService } from '../../../src/page/PublicAssetsService';

/** Fake build of apps/public, shaped like Vite's output. */
export const PublicBuildDirectory = fileURLToPath(
  new URL('../fixtures/publicBuild', import.meta.url),
);

/** Paths of the fake build's files, relative to its directory. */
export const PublicBuildFiles = {
  script: 'assets/certificate-abc123.js',
  style: 'assets/certificate-def456.css',
  pdfjsFallback: 'pdfjs/6.5.438/wasm/openjpeg_nowasm_fallback.js',
  lookupScript: 'assets/lookup-ghi789.js',
};

/** The org name the public pages show. */
export const PublicPageOrgName = 'Acme Institute';

/** Lookups allowed per client IP, as in the default config. */
export const LookupMaxRequests = 10;

/** The public pages' services of HttpService, started on the fake build. */
export function createPublicPageOptions(
  database: DatabaseService,
  siteUrl: SiteUrl,
): {
  publicAssets: PublicAssetsService;
  certificatePages: CertificatePageService;
  lookupPages: LookupPageService;
} {
  const publicAssets = new PublicAssetsService({
    directory: PublicBuildDirectory,
    siteUrl,
  });
  publicAssets.start();

  return {
    publicAssets,
    certificatePages: new CertificatePageService({
      database,
      assets: publicAssets,
      siteUrl,
      locales: new LocaleResolver({ defaultLocale: LocaleEnum.En }),
      orgName: PublicPageOrgName,
    }),
    lookupPages: new LookupPageService({
      database,
      assets: publicAssets,
      siteUrl,
      limiter: new RateLimiter({
        maxHits: LookupMaxRequests,
        windowMs: 10 * 60 * 1000,
      }),
      csrf: new CsrfGuard({ origin: siteUrl.getOrigin() }),
      orgName: PublicPageOrgName,
    }),
  };
}

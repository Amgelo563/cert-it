import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CsrfGuard, RateLimiter, type SiteUrl } from '@cert-it/hono';
import { LocaleEnum } from '@cert-it/shared';
import { LookupPageRoutes } from '../../../src/certificate/lookup/LookupPageRoutes';
import { CertificatePageRoutes } from '../../../src/certificate/page/CertificatePageRoutes';
import { LinkedInProfileLink } from '../../../src/certificate/page/LinkedInProfileLink';
import type { CredentialRoutes } from '../../../src/credential/CredentialRoutes';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { LocaleResolver } from '../../../src/i18n/LocaleResolver';
import { MessageCatalog } from '../../../src/i18n/MessageCatalog';
import type { BrandingService } from '../../../src/branding/BrandingService';
import { LinkPreviewService } from '../../../src/page/preview/LinkPreviewService';
import { PublicAssetsService } from '../../../src/page/PublicAssetsService';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { createTestCredentials } from '../../credential/mocks/createTestCredentials';
import { createTestBranding } from '../../branding/mocks/createTestBranding';

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

/** The site.linkedin_org_id of the public pages, unless a test leaves it out. */
export const PublicPageLinkedInOrgId = '1234567';

/** Lookups allowed per client IP, as in the default config. */
export const LookupMaxRequests = 10;

/** Link preview settings, as in link_previews, with the defaults of the config. */
export type LinkPreviewSettings = Partial<
  Pick<
    ConstructorParameters<typeof LinkPreviewService>[0],
    'siteName' | 'title' | 'description' | 'image' | 'imageAlt' | 'largeImage'
  >
> & {
  /** Where a local image is read from. */
  dataDirectory?: DataDirectoryService;
};

/** Theme color of the default config. */
export const LinkPreviewThemeColor = '#0050b4';

/** The public pages' services of HttpService, started on the fake build, with the credential routes. */
export function createPublicPageOptions(
  database: DatabaseService,
  siteUrl: SiteUrl,
  previewSettings: LinkPreviewSettings = {},
  linkedinOrgId: string | null = PublicPageLinkedInOrgId,
  branding: BrandingService = createTestBranding(siteUrl),
): {
  publicAssets: PublicAssetsService;
  branding: BrandingService;
  linkPreviews: LinkPreviewService;
  certificatePages: CertificatePageRoutes;
  lookupPages: LookupPageRoutes;
  credentials: CredentialRoutes;
} {
  const publicAssets = new PublicAssetsService({
    directory: PublicBuildDirectory,
    siteUrl,
  });
  publicAssets.start();
  const { dataDirectory, ...settings } = previewSettings;
  const linkPreviews = new LinkPreviewService({
    siteUrl,
    // only read for a local image, so it's never created by default
    dataDirectory:
      dataDirectory
      ?? DataDirectoryService.create({
        root: join(tmpdir(), `cert-it-unused-${randomUUID()}`),
      }),
    messages: new MessageCatalog(),
    siteName: PublicPageOrgName,
    largeImage: true,
    themeColor: LinkPreviewThemeColor,
    ...settings,
  });
  linkPreviews.start();

  return {
    publicAssets,
    branding,
    linkPreviews,
    certificatePages: new CertificatePageRoutes({
      database,
      assets: publicAssets,
      branding,
      previews: linkPreviews,
      siteUrl,
      locales: new LocaleResolver({ defaultLocale: LocaleEnum.En }),
      orgName: PublicPageOrgName,
      linkedIn: linkedinOrgId
        ? new LinkedInProfileLink({ organizationId: linkedinOrgId })
        : null,
    }),
    lookupPages: new LookupPageRoutes({
      database,
      assets: publicAssets,
      branding,
      previews: linkPreviews,
      siteUrl,
      limiter: new RateLimiter({
        maxHits: LookupMaxRequests,
        windowMs: 10 * 60 * 1000,
      }),
      csrf: new CsrfGuard({ origin: siteUrl.getOrigin() }),
      orgName: PublicPageOrgName,
    }),
    credentials: createTestCredentials(database, siteUrl).service,
  };
}

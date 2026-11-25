import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SiteUrl } from '@cert-it/hono';
import { ThemeValues } from '@cert-it/shared';
import { BrandingService } from '../../../src/branding/BrandingService';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';

/** Favicon URL of the test branding when none is configured. */
export const TestDefaultFavicon = '/admin/favicon.svg';

/** A started branding service, with the built-in look unless options say otherwise. */
export function createTestBranding(
  siteUrl: SiteUrl,
  options: Partial<
    Omit<ConstructorParameters<typeof BrandingService>[0], 'siteUrl'>
  > = {},
): BrandingService {
  const branding = new BrandingService({
    siteUrl,
    // only read for configured files, so it's never created by default
    dataDirectory: DataDirectoryService.create({
      root: join(tmpdir(), `cert-it-unused-${randomUUID()}`),
    }),
    name: 'cert-it',
    primaryColor: ThemeValues.brandShades[ThemeValues.brandShadeIndex],
    defaultFavicon: TestDefaultFavicon,
    ...options,
  });
  branding.start();
  return branding;
}

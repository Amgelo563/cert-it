import type { AdminBranding } from '@cert-it/shared';
import { useContext } from 'react';
import { BrandingContext } from './BrandingContext';

/** Returns the site's name, colors, logo and font. */
export function useBranding(): AdminBranding {
  return useContext(BrandingContext);
}

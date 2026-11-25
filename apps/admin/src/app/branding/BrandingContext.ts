import type { AdminBranding } from '@cert-it/shared';
import { createContext } from 'react';
import { DefaultBranding } from './readSiteBranding';

/** The site's branding, read with useBranding. */
export const BrandingContext = createContext<AdminBranding>(DefaultBranding);

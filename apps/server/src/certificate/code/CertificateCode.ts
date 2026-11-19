import type { Brand } from '@cert-it/shared';

/** The random, public code of a certificate, in the `XXXX-XXXX-XX` format. */
export type CertificateCode = Brand<string, 'CertificateCode'>;

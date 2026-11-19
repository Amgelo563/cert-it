import type { CertificateCode } from '../../code/CertificateCode';

/** An error for a certificate whose PDF is missing from the data directory. */
export class CertificateFileNotFoundError extends Error {
  constructor(code: CertificateCode, options?: ErrorOptions) {
    super(`The PDF of certificate ${code} is missing.`, options);
    this.name = 'CertificateFileNotFoundError';
  }
}

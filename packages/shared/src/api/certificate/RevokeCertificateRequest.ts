import { type output, strictObject, string } from 'zod';

export const RevokeCertificateRequestSchema = strictObject({
  /** Shown on the certificate's public page. */
  reason: string().trim().min(1).max(500),
});

/** The body of a request to revoke a certificate. */
export type RevokeCertificateRequest = output<
  typeof RevokeCertificateRequestSchema
>;

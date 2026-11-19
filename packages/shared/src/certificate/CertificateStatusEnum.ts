export const CertificateStatusEnum = {
  Active: 'active',
  Revoked: 'revoked',
} as const;

/** Whether a certificate is valid or has been revoked. */
export type CertificateStatus =
  (typeof CertificateStatusEnum)[keyof typeof CertificateStatusEnum];

/** Which participants to list by their certificate. */
export const ParticipantCertificateFilterEnum = {
  /** Participants without a certificate. */
  None: 'none',
  Active: 'active',
  Revoked: 'revoked',
} as const;

/** A filter of participants by their certificate. */
export type ParticipantCertificateFilter =
  (typeof ParticipantCertificateFilterEnum)[keyof typeof ParticipantCertificateFilterEnum];

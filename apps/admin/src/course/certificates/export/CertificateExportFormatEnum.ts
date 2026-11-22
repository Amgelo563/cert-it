/** The files a course's certificates can be exported as, as the last segment of their route. */
export const CertificateExportFormatEnum = {
  /** The active certificates' PDFs. */
  Zip: 'zip',
  /** Every certificate's code, status and public URL. */
  Csv: 'csv',
} as const;

/** A file a course's certificates can be exported as. */
export type CertificateExportFormat =
  (typeof CertificateExportFormatEnum)[keyof typeof CertificateExportFormatEnum];

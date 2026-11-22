import type { CertificateExportFormat } from './CertificateExportFormatEnum';

/** Returns the URL of a course's certificate export, which a link downloads without holding it in memory. */
export function certificateExportUrl(
  courseId: number,
  format: CertificateExportFormat,
): string {
  return new URL(
    `../api/courses/${courseId}/certificates/export/${format}`,
    document.baseURI,
  ).href;
}

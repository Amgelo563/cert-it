import type { CourseId } from '../../course/Course';
import type { CertificateCode } from '../code/CertificateCode';

/** The certificate PDF to send, and how the browser should handle it. */
export type ServedFile = {
  courseId: CourseId;
  code: CertificateCode;
  /** Whether the browser saves the file (`attachment`) instead of showing it (`inline`). */
  download: boolean;
};

/** An object that sends certificate PDFs, set by `files.serve` (STO-2). Callers check the certificate's status first. */
export interface FileServer {
  /**
   * Returns the response that sends the given certificate's PDF.
   *
   * @throws {CertificateFileNotFoundError} If the app reads the file itself and it's missing.
   */
  serve(request: Request, file: ServedFile): Promise<Response>;
}

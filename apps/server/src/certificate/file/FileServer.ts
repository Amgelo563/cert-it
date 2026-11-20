import type { DoesntExistFileError, FileSystemError } from '@cert-it/shared';
import type { Result } from 'better-result';
import type { Context } from 'hono';
import type { CourseId } from '../../course/Course';
import type { CertificateCode } from '../code/CertificateCode';

/** The certificate PDF to send, and how the browser should handle it. */
export type ServedFile = {
  courseId: CourseId;
  code: CertificateCode;
  /** Whether the browser saves the file (`attachment`) instead of showing it (`inline`). */
  download: boolean;
};

/** An object that sends certificate PDFs, set by `files.serve`. Callers check the certificate's status first. */
export interface FileServer {
  /** Returns the response that sends the given certificate's PDF, or why the app couldn't read it when it reads the file itself. */
  serve(
    c: Context,
    file: ServedFile,
  ): Promise<Result<Response, DoesntExistFileError | FileSystemError>>;
}

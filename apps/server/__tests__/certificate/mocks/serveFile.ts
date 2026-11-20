import type { DoesntExistFileError, FileSystemError } from '@cert-it/shared';
import type { Result } from 'better-result';
import { Hono } from 'hono';
import type {
  FileServer,
  ServedFile,
} from '../../../src/certificate/file/FileServer';

/** Returns what the server answers for the file, called from inside a route as CertificateFileService does. */
export async function serveFile(
  server: FileServer,
  file: ServedFile,
  init: RequestInit = {},
): Promise<Result<Response, DoesntExistFileError | FileSystemError>> {
  let result: Result<Response, DoesntExistFileError | FileSystemError> | null =
    null;
  const app = new Hono();
  app.on(['GET', 'HEAD'], '*', async (c) => {
    result = await server.serve(c, file);
    return c.body(null);
  });

  await app.request('https://certs.example.org/c/ABCD-EFGH-JK/pdf', init);
  return result!;
}

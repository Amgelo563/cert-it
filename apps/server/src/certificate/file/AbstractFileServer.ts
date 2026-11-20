import type { DoesntExistFileError, FileSystemError } from '@cert-it/shared';
import type { Result } from 'better-result';
import type { Context } from 'hono';
import type { FileServer, ServedFile } from './FileServer';

/** A base for {@link FileServer}s, with the headers every mode sends. nginx keeps these through `X-Accel-Redirect`. */
export abstract class AbstractFileServer implements FileServer {
  // the status is checked on every request, so a revoked certificate stops being served at once
  protected static readonly CacheControl = 'no-cache';

  protected static readonly ContentType = 'application/pdf';

  public abstract serve(
    c: Context,
    file: ServedFile,
  ): Promise<Result<Response, DoesntExistFileError | FileSystemError>>;

  protected createHeaders(file: ServedFile): Headers {
    const disposition = file.download ? 'attachment' : 'inline';

    return new Headers({
      'Content-Type': AbstractFileServer.ContentType,
      'Content-Disposition': `${disposition}; filename="certificate-${file.code}.pdf"`,
      'Cache-Control': AbstractFileServer.CacheControl,
    });
  }
}

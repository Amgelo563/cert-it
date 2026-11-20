import { FileStreamer } from '@cert-it/hono';
import type { DoesntExistFileError, FileSystemError } from '@cert-it/shared';
import type { Result } from 'better-result';
import type { Context } from 'hono';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import { AbstractFileServer } from './AbstractFileServer';
import type { ServedFile } from './FileServer';

type StreamFileServerOptions = {
  dataDirectory: DataDirectoryService;
};

/** Sends PDFs from the app itself, with single-range `Range` support for the pdf.js preview (`files.serve: stream`). */
export class StreamFileServer extends AbstractFileServer {
  protected readonly dataDirectory: DataDirectoryService;

  constructor(options: StreamFileServerOptions) {
    super();
    this.dataDirectory = options.dataDirectory;
  }

  public override serve(
    c: Context,
    file: ServedFile,
  ): Promise<Result<Response, DoesntExistFileError | FileSystemError>> {
    const path = this.dataDirectory.getCertificatePath(
      file.courseId,
      file.code,
    );

    return FileStreamer.Instance.send(c, path, this.createHeaders(file));
  }
}

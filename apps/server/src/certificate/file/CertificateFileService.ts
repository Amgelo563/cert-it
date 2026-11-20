import { SiteUrl } from '@cert-it/hono';
import { CertificateStatusEnum, FileSystemError } from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { Config } from '../../config/schema/ConfigSchema';
import {
  type FileServeMode,
  FileServeModeEnum,
} from '../../config/schema/enums/FileServeModeEnum';
import type { DatabaseService } from '../../database/DatabaseService';
import type { HttpEnv } from '../../http/HttpEnv';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import type { CertificateCode } from '../code/CertificateCode';
import { AccelFileServer } from './AccelFileServer';
import type { FileServer } from './FileServer';
import { StreamFileServer } from './StreamFileServer';

type CertificateFileServiceOptions = {
  database: DatabaseService;
  fileServer: FileServer;
  /** @default console.error */
  logError?: (line: string) => void;
};

/** Serves certificate PDFs at `{base_path}/c/{code}/pdf`, only while the certificate is active. */
export class CertificateFileService {
  /** Path of a certificate's PDF, relative to the base path. `?download=1` makes the browser save it. */
  public static readonly Path = '/c/:code/pdf';

  protected static readonly DownloadParam = 'download';

  protected readonly database: DatabaseService;

  protected readonly fileServer: FileServer;

  protected readonly logError: (line: string) => void;

  protected readonly app: Hono<HttpEnv>;

  constructor(options: CertificateFileServiceOptions) {
    this.database = options.database;
    this.fileServer = options.fileServer;
    this.logError = options.logError ?? console.error;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    injections?: Partial<CertificateFileServiceOptions>;
  }): CertificateFileService {
    const { config, database, dataDirectory, injections } = options;
    const fileServers: Record<FileServeMode, () => FileServer> = {
      [FileServeModeEnum.Stream]: () => new StreamFileServer({ dataDirectory }),
      [FileServeModeEnum.Accel]: () =>
        new AccelFileServer({
          siteUrl: new SiteUrl({ baseUrl: config.site.baseUrl }),
        }),
    };

    return new CertificateFileService({
      database: injections?.database ?? database,
      fileServer: injections?.fileServer ?? fileServers[config.files.serve](),
      logError: injections?.logError,
    });
  }

  /** Returns the routes, to mount under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  protected createApp(): Hono<HttpEnv> {
    const app = new Hono<HttpEnv>({ strict: false });
    app.get(CertificateFileService.Path, (c) => this.servePdf(c));
    return app;
  }

  // a revoked or unknown code answers the same 404, so the PDF never outlives revocation
  protected async servePdf(c: Context<HttpEnv>): Promise<Response> {
    const code = c.req.param('code') as CertificateCode;
    const certificate = this.database
      .getRepositories()
      .certificates.findByCode(code);

    if (certificate?.status !== CertificateStatusEnum.Active) {
      return this.notFound(c);
    }

    const result = await this.fileServer.serve(c, {
      courseId: certificate.courseId,
      code: certificate.code,
      download: c.req.query(CertificateFileService.DownloadParam) === '1',
    });

    if (result.isOk()) return result.value;

    // other read failures go to the 500 handler
    if (FileSystemError.is(result.error)) throw result.error.cause;

    this.logError(`The PDF of certificate ${certificate.code} is missing.`);
    return this.notFound(c);
  }

  protected notFound(c: Context<HttpEnv>): Response {
    c.header('Cache-Control', 'no-store');
    return c.text('Not Found', 404);
  }
}

import type { SiteUrl } from '@cert-it/hono';
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
import { ConsoleLogger } from '../../log/ConsoleLogger';
import type { Logger } from '../../log/Logger';

type CertificateFileRoutesOptions = {
  database: DatabaseService;
  fileServer: FileServer;
  logger: Logger;
};

/** Serves certificate PDFs at `{base_path}/c/{code}/pdf`, only while the certificate is active. */
export class CertificateFileRoutes {
  /** Path of a certificate's PDF, relative to the base path. `?download=1` makes the browser save it. */
  public static readonly Path = '/c/:code/pdf';

  protected static readonly DownloadParam = 'download';

  protected readonly database: DatabaseService;

  protected readonly fileServer: FileServer;

  protected readonly logger: Logger;

  protected readonly app: Hono<HttpEnv>;

  constructor(options: CertificateFileRoutesOptions) {
    this.database = options.database;
    this.fileServer = options.fileServer;
    this.logger = options.logger;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'files'>;
    siteUrl: SiteUrl;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    injections?: Partial<
      Pick<CertificateFileRoutesOptions, 'fileServer' | 'logger'>
    >;
  }): CertificateFileRoutes {
    const { config, siteUrl, database, dataDirectory, injections } = options;
    const fileServers: Record<FileServeMode, () => FileServer> = {
      [FileServeModeEnum.Stream]: () => new StreamFileServer({ dataDirectory }),
      [FileServeModeEnum.Accel]: () => new AccelFileServer({ siteUrl }),
    };

    return new CertificateFileRoutes({
      database,
      fileServer: injections?.fileServer ?? fileServers[config.files.serve](),
      logger: injections?.logger ?? ConsoleLogger.Instance,
    });
  }

  /** Returns the routes, to mount under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  protected createApp(): Hono<HttpEnv> {
    const app = new Hono<HttpEnv>({ strict: false });
    app.get(CertificateFileRoutes.Path, (c) => this.servePdf(c));
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
      download: c.req.query(CertificateFileRoutes.DownloadParam) === '1',
    });

    if (result.isOk()) return result.value;

    // other read failures go to the 500 handler
    if (FileSystemError.is(result.error)) throw result.error.cause;

    this.logger.error(`The PDF of certificate ${certificate.code} is missing.`);
    return this.notFound(c);
  }

  protected notFound(c: Context<HttpEnv>): Response {
    c.header('Cache-Control', 'no-store');
    return c.text('Not Found', 404);
  }
}

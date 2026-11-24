import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { SiteUrl } from '@cert-it/hono';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  CertificateStatusEnum,
  PermissionEnum,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import { ZipFile } from 'yazl';
import type { AuthGuard } from '../../auth/AuthGuard';
import type { Course } from '../../course/Course';
import type { CredentialSigner } from '../../credential/CredentialSigner';
import { OpenBadgeBuilder } from '../../credential/OpenBadgeBuilder';
import type { DatabaseService } from '../../database/DatabaseService';
import { AbstractApiRoutes } from '../../http/api/AbstractApiRoutes';
import { attachmentDisposition } from '../../http/util/attachmentDisposition';
import type { Participant } from '../../participant/Participant';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import type { Certificate } from '../Certificate';
import { ConsoleLogger } from '../../log/ConsoleLogger';
import type { Logger } from '../../log/Logger';
import type { CourseEnv } from '../../course/CourseEnv';
import { CourseLoader } from '../../course/CourseLoader';

type CertificateExportRoutesOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  courseLoader: CourseLoader;
  dataDirectory: DataDirectoryService;
  /** Builds the public URLs in the CSV. */
  siteUrl: SiteUrl;
  /** Signs the credential next to each PDF in the ZIP. */
  credentials: CredentialSigner;
  logger: Logger;
};

/** A certificate with its participant, as both exports list it. */
type ExportRow = {
  certificate: Certificate;
  participant: Participant;
};

/** Serves a course's certificate exports to Editors: its active PDFs and their signed credentials as a streamed ZIP, and a CSV of every code and URL. */
export class CertificateExportRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/certificates/export';

  protected static override readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
  };

  protected static readonly CsvHeader = [
    'name',
    'email',
    'code',
    'status',
    'issue_date',
    'template_version',
    'url',
    'credential_url',
    'revoked_reason',
  ];

  /** The byte order mark that starts a CSV, so Excel reads it as UTF-8. */
  protected static readonly CsvByteOrderMark = String.fromCodePoint(0xfe_ff);

  // a spreadsheet runs a cell starting with these as a formula
  protected static readonly CsvFormulaStart = /^[=+\-@\t\r]/;

  protected static readonly CsvNeedsQuotes = /[",\r\n]/;

  // characters a file system may reject, and format controls that can disguise an extension
  protected static readonly UnsafeNameCharacters = /[\\/:*?"<>|\p{Cc}\p{Cf}]/gu;

  protected static readonly MaxNameLength = 100;

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly courseLoader: CourseLoader;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly siteUrl: SiteUrl;

  protected readonly credentials: CredentialSigner;

  protected readonly logger: Logger;

  protected readonly app: ReturnType<CertificateExportRoutes['createApp']>;

  constructor(options: CertificateExportRoutesOptions) {
    super();
    this.database = options.database;
    this.guard = options.guard;
    this.courseLoader = options.courseLoader;
    this.dataDirectory = options.dataDirectory;
    this.siteUrl = options.siteUrl;
    this.credentials = options.credentials;
    this.logger = options.logger;
    this.app = this.createApp();
  }

  public static create(options: {
    siteUrl: SiteUrl;
    database: DatabaseService;
    guard: AuthGuard;
    dataDirectory: DataDirectoryService;
    credentials: CredentialSigner;
    injections?: Partial<
      Pick<
        CertificateExportRoutesOptions,
        'siteUrl' | 'logger' | 'courseLoader'
      >
    >;
  }): CertificateExportRoutes {
    const { siteUrl, injections, ...shared } = options;

    return new CertificateExportRoutes({
      ...shared,
      courseLoader:
        injections?.courseLoader
        ?? CourseLoader.create({ database: shared.database }),
      siteUrl,
      logger: injections?.logger ?? ConsoleLogger.Instance,
    });
  }

  /** Returns the routes, to mount at {@link CertificateExportRoutes.Path}. */
  public getApp(): CertificateExportRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<CourseEnv>({ strict: false })
      .use(guard.authenticate())
      .get(
        '/zip',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        this.courseLoader.middleware(),
        (c) => this.zip(c),
      )
      .get(
        '/csv',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        this.courseLoader.middleware(),
        (c) => this.csv(c),
      );
  }

  // revoked PDFs aren't served, so they aren't exported either
  protected async zip(c: Context<CourseEnv>): Promise<Response> {
    const course = c.get('course');

    const rows = this.listRows(course).filter(
      ({ certificate }) => certificate.status === CertificateStatusEnum.Active,
    );
    const zip = new ZipFile();
    for (const { certificate, participant } of rows) {
      const path = this.dataDirectory.getCertificatePath(
        course.id,
        certificate.code,
      );
      // a job may not have written it yet; the ZIP must not fail halfway
      const file = await stat(path).catch(() => null);
      if (!file?.isFile()) {
        this.logger.error(`Left ${path} out of the ZIP: the file is missing.`);
        continue;
      }
      // PDFs are compressed already
      zip.addFile(path, this.entryName(participant, certificate, 'pdf'), {
        compress: false,
        mtime: file.mtime,
      });
      const jwt = this.credentials.signCertificate({
        certificate,
        course,
        participant,
      });
      zip.addBuffer(
        Buffer.from(jwt),
        this.entryName(participant, certificate, 'jwt'),
        { mtime: file.mtime },
      );
    }
    zip.end();

    return new Response(
      // yazl types it loosely; it is a PassThrough
      Readable.toWeb(
        zip.outputStream as Readable,
      ) as ReadableStream<Uint8Array>,
      {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': attachmentDisposition(
            `${course.name} - certificates.zip`,
          ),
        },
      },
    );
  }

  protected csv(c: Context<CourseEnv>) {
    const course = c.get('course');

    const rows = this.listRows(course);
    const versions = this.database
      .getRepositories()
      .templateVersions.findVersionNumbers([
        ...new Set(
          rows.map(({ certificate }) => certificate.templateVersionId),
        ),
      ]);
    const body = CertificateExportRoutes.formatCsv([
      CertificateExportRoutes.CsvHeader,
      ...rows.map(({ certificate, participant }) => [
        participant.name,
        participant.email,
        certificate.code,
        certificate.status,
        certificate.issueDate,
        String(versions.get(certificate.templateVersionId) ?? ''),
        this.siteUrl.url(`/c/${certificate.code}`),
        // served only while active, as the PDF
        certificate.status === CertificateStatusEnum.Active
          ? this.siteUrl.url(
              OpenBadgeBuilder.CredentialPath.replace(
                ':code',
                certificate.code,
              ),
            )
          : '',
        certificate.revokedReason ?? '',
      ]),
    ]);

    return c.body(body, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': attachmentDisposition(
        `${course.name} - certificates.csv`,
      ),
    });
  }

  // sorted by participant name, as the panel lists them
  protected listRows(course: Course): ExportRow[] {
    const { certificates, participants } = this.database.getRepositories();
    const all = certificates.listAllByCourse(course.id);
    const byId = new Map(
      participants
        .findByIds(all.map((certificate) => certificate.participantId))
        .map((participant) => [participant.id, participant]),
    );

    return all
      .flatMap((certificate) => {
        const participant = byId.get(certificate.participantId);
        return participant ? [{ certificate, participant }] : [];
      })
      .sort(
        (a, b) =>
          a.participant.name.localeCompare(b.participant.name)
          || a.certificate.id - b.certificate.id,
      );
  }

  // the code keeps names unique, even for two participants with the same name
  protected entryName(
    participant: Participant,
    certificate: Certificate,
    extension: 'pdf' | 'jwt',
  ) {
    const name = participant.name
      .replace(CertificateExportRoutes.UnsafeNameCharacters, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CertificateExportRoutes.MaxNameLength);
    return name
      ? `${name} - ${certificate.code}.${extension}`
      : `${certificate.code}.${extension}`;
  }

  /**
   * Returns rows as CSV text for spreadsheets: comma separated, CRLF line ends and a UTF-8 byte order mark, so Excel reads accents.
   *
   * Cells that a spreadsheet would run as a formula get a leading apostrophe, since names come from imported files.
   */
  protected static formatCsv(rows: readonly (readonly string[])[]): string {
    const lines = rows.map((row) =>
      row.map((cell) => CertificateExportRoutes.formatCsvCell(cell)).join(','),
    );
    return `${CertificateExportRoutes.CsvByteOrderMark}${lines.join('\r\n')}\r\n`;
  }

  protected static formatCsvCell(value: string): string {
    const safe = CertificateExportRoutes.CsvFormulaStart.test(value)
      ? `'${value}`
      : value;
    return CertificateExportRoutes.CsvNeedsQuotes.test(safe)
      ? `"${safe.replaceAll('"', '""')}"`
      : safe;
  }
}

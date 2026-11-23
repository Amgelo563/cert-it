import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { SiteUrl } from '@cert-it/hono';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  CertificateStatusEnum,
  PermissionEnum,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import { ZipFile } from 'yazl';
import type { AuthEnv } from '../../auth/AuthEnv';
import type { AuthGuard } from '../../auth/AuthGuard';
import type { Config } from '../../config/schema/ConfigSchema';
import type { Course, CourseId } from '../../course/Course';
import type { DatabaseService } from '../../database/DatabaseService';
import { apiError } from '../../http/api/apiError';
import { attachmentDisposition } from '../../http/attachmentDisposition';
import type { Participant } from '../../participant/Participant';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import { formatCsv } from '../../util/csv/formatCsv';
import type { Certificate } from '../Certificate';

type CertificateExportServiceOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  dataDirectory: DataDirectoryService;
  /** Builds the public URLs in the CSV. */
  siteUrl: SiteUrl;
  /** @default console.error */
  log?: (line: string) => void;
};

/** A certificate with its participant, as both exports list it. */
type ExportRow = {
  certificate: Certificate;
  participant: Participant;
};

/** Serves a course's certificate exports to Editors: its active PDFs as a streamed ZIP, and a CSV of every code and URL. */
export class CertificateExportService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/certificates/export';

  protected static readonly ErrorStatuses: Partial<
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
    'revoked_reason',
  ];

  // characters a file system may reject in a name
  protected static readonly UnsafeNameCharacters = /[\\/:*?"<>|\p{Cc}]/gu;

  protected static readonly MaxNameLength = 100;

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly siteUrl: SiteUrl;

  protected readonly log: (line: string) => void;

  protected readonly app: ReturnType<CertificateExportService['createApp']>;

  constructor(options: CertificateExportServiceOptions) {
    this.database = options.database;
    this.guard = options.guard;
    this.dataDirectory = options.dataDirectory;
    this.siteUrl = options.siteUrl;
    this.log = options.log ?? console.error;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    guard: AuthGuard;
    dataDirectory: DataDirectoryService;
    injections?: Partial<CertificateExportServiceOptions>;
  }): CertificateExportService {
    const { config, injections, ...defaults } = options;
    return new CertificateExportService({
      ...defaults,
      siteUrl: new SiteUrl({ baseUrl: config.site.baseUrl }),
      ...injections,
    });
  }

  /** Returns the routes, to mount at {@link CertificateExportService.Path}. */
  public getApp(): CertificateExportService['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<AuthEnv>({ strict: false })
      .use(guard.authenticate())
      .get(
        '/zip',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        (c) => this.zip(c),
      )
      .get(
        '/csv',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        (c) => this.csv(c),
      );
  }

  // revoked PDFs aren't served, so they aren't exported either
  protected async zip(c: Context<AuthEnv>): Promise<Response> {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

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
        this.log(`Left ${path} out of the ZIP: the file is missing.`);
        continue;
      }
      // PDFs are compressed already
      zip.addFile(path, this.entryName(participant, certificate), {
        compress: false,
        mtime: file.mtime,
      });
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

  protected csv(c: Context<AuthEnv>) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const rows = this.listRows(course);
    const versions = this.database
      .getRepositories()
      .templateVersions.findVersionNumbers([
        ...new Set(
          rows.map(({ certificate }) => certificate.templateVersionId),
        ),
      ]);
    const body = formatCsv([
      CertificateExportService.CsvHeader,
      ...rows.map(({ certificate, participant }) => [
        participant.name,
        participant.email,
        certificate.code,
        certificate.status,
        certificate.issueDate,
        String(versions.get(certificate.templateVersionId) ?? ''),
        this.siteUrl.url(`/c/${certificate.code}`),
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
  protected entryName(participant: Participant, certificate: Certificate) {
    const name = participant.name
      .replace(CertificateExportService.UnsafeNameCharacters, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CertificateExportService.MaxNameLength);
    return name
      ? `${name} - ${certificate.code}.pdf`
      : `${certificate.code}.pdf`;
  }

  protected findCourse(c: Context<AuthEnv>): Course | null {
    const id = Number(c.req.param('courseId'));
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return this.database.getRepositories().courses.findById(id as CourseId);
  }

  protected error(c: Context<AuthEnv>, code: ApiErrorCode) {
    return apiError(
      c,
      CertificateExportService.ErrorStatuses[code] ?? 400,
      code,
    );
  }
}

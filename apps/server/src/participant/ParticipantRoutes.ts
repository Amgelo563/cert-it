import { DuplicateModelError } from '@cert-it/data';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type ApiPage,
  type AuditChange,
  AuditActionEnum,
  AuditEntityEnum,
  type CreateParticipantRequest,
  type ImportParticipantsRequest,
  ImportParticipantsRequestSchema,
  type ImportParticipantsResponse,
  CreateParticipantRequestSchema,
  type ParticipantListQuery,
  ParticipantListQuerySchema,
  type ParticipantSummary,
  PermissionEnum,
  type UpdateParticipantRequest,
  UpdateParticipantRequestSchema,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuditLog } from '../audit/AuditLog';
import type { AuthGuard } from '../auth/AuthGuard';
import type { CertificateManager } from '../certificate/CertificateManager';
import type { CertificateRegenerator } from '../certificate/job/CertificateRegenerator';
import type { DatabaseService } from '../database/DatabaseService';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import { normalizeEmail } from '../util/email/NormalizedEmail';
import { ParticipantImporter } from './import/ParticipantImporter';
import type { Participant, ParticipantId } from './Participant';
import type { CourseEnv } from '../course/CourseEnv';
import { CourseLoader } from '../course/CourseLoader';

type ParticipantRoutesOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  courseLoader: CourseLoader;
  auditLog: AuditLog;
  /** Deletes a participant's certificate PDF with them. */
  certificates: CertificateManager;
  /** Renders a certificate again when its participant's name changes. */
  regenerator: CertificateRegenerator;
  importer: ParticipantImporter;
};

/** Serves a course's participant routes: anyone can read them, Editors change them and Admins delete them. */
export class ParticipantRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/participants';

  // a full import of MaxImportRows rows, with room for long names and extra columns
  protected static readonly MaxImportBytes = 4 * 1024 * 1024;

  protected static override readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.ParticipantEmailTaken]: 409,
  };

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly courseLoader: CourseLoader;

  protected readonly auditLog: AuditLog;

  protected readonly importer: ParticipantImporter;

  protected readonly certificates: CertificateManager;

  protected readonly regenerator: CertificateRegenerator;

  protected readonly app: ReturnType<ParticipantRoutes['createApp']>;

  constructor(options: ParticipantRoutesOptions) {
    super();
    this.database = options.database;
    this.guard = options.guard;
    this.courseLoader = options.courseLoader;
    this.auditLog = options.auditLog;
    this.importer = options.importer;
    this.certificates = options.certificates;
    this.regenerator = options.regenerator;
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    guard: AuthGuard;
    auditLog: AuditLog;
    certificates: CertificateManager;
    regenerator: CertificateRegenerator;
    injections?: Partial<
      Pick<ParticipantRoutesOptions, 'importer' | 'courseLoader'>
    >;
  }): ParticipantRoutes {
    const { injections, ...defaults } = options;

    return new ParticipantRoutes({
      ...defaults,
      courseLoader:
        injections?.courseLoader
        ?? CourseLoader.create({ database: defaults.database }),
      importer:
        injections?.importer
        ?? new ParticipantImporter({ database: defaults.database }),
    });
  }

  /** Returns the routes, to mount at {@link ParticipantRoutes.Path}. */
  public getApp(): ParticipantRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<CourseEnv>({ strict: false })
      .use(guard.authenticate())
      .get(
        '/',
        guard.requirePermission(PermissionEnum.ViewRecords),
        ParticipantRoutes.validator('query', ParticipantListQuerySchema),
        this.courseLoader.middleware(),
        (c) => this.list(c, c.req.valid('query')),
      )
      .post(
        '/',
        guard.requirePermission(PermissionEnum.EditParticipants),
        ParticipantRoutes.bodyLimit(),
        ParticipantRoutes.validator('json', CreateParticipantRequestSchema),
        this.courseLoader.middleware(),
        (c) => this.add(c, c.req.valid('json')),
      )
      .patch(
        '/:id',
        guard.requirePermission(PermissionEnum.EditParticipants),
        ParticipantRoutes.bodyLimit(),
        ParticipantRoutes.validator('json', UpdateParticipantRequestSchema),
        this.courseLoader.middleware(),
        (c) => this.update(c, c.req.valid('json')),
      )
      .post(
        '/import',
        guard.requirePermission(PermissionEnum.EditParticipants),
        ParticipantRoutes.bodyLimit(ParticipantRoutes.MaxImportBytes),
        ParticipantRoutes.validator('json', ImportParticipantsRequestSchema),
        this.courseLoader.middleware(),
        (c) => this.import(c, c.req.valid('json')),
      )
      .delete(
        '/:id',
        guard.requirePermission(PermissionEnum.DeleteRecords),
        this.courseLoader.middleware(),
        (c) => this.remove(c),
      );
  }

  // one audit entry for the whole import, and none for a dry run
  protected import(c: Context<CourseEnv>, body: ImportParticipantsRequest) {
    const course = c.get('course');

    // the rows, their audit entry and the jobs, or none of them
    const response = this.database.atomically(() => {
      const imported = this.importer.run({
        courseId: course.id,
        rows: body.rows,
        mode: body.mode,
        dryRun: body.dryRun,
      });
      if (!body.dryRun) {
        this.auditLog.record({
          userId: c.get('user').id,
          action: AuditActionEnum.Import,
          entity: AuditEntityEnum.Course,
          entityId: course.id,
          details: { mode: body.mode, ...imported.response.totals },
        });
        this.regenerate(c, imported.renamed);
      }
      return imported.response;
    });
    return c.json<ImportParticipantsResponse, 200>(response, 200);
  }

  protected list(c: Context<CourseEnv>, query: ParticipantListQuery) {
    const course = c.get('course');

    const { search, certificate, ...page } = query;
    const participants = this.database
      .getRepositories()
      .participants.listByCourse(course.id, page, search, certificate);
    return c.json<ApiPage<ParticipantSummary>, 200>(
      { ...participants, items: this.toSummaries(participants.items) },
      200,
    );
  }

  protected add(c: Context<CourseEnv>, body: CreateParticipantRequest) {
    const course = c.get('course');

    const created = this.database
      .getUnitOfWork()
      .transaction(({ participants }) =>
        participants
          .create({
            courseId: course.id,
            name: body.name,
            email: normalizeEmail(body.email),
          })
          .map((participant) => {
            this.audit(c, participant, {
              action: AuditActionEnum.Create,
              details: {
                email: participant.email,
              },
            });
            return participant;
          }),
      );
    if (created.isErr()) {
      return this.error(c, ApiErrorCodeEnum.ParticipantEmailTaken);
    }

    const participant = created.value;
    return c.json<ParticipantSummary, 201>(
      this.toSummaries([participant])[0]!,
      201,
    );
  }

  protected update(c: Context<CourseEnv>, body: UpdateParticipantRequest) {
    const target = this.findParticipant(c);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);

    const updated = this.database
      .getUnitOfWork()
      .transaction(({ participants }) =>
        participants
          .update(target.id, {
            name: body.name,
            email:
              body.email === undefined ? undefined : normalizeEmail(body.email),
          })
          .map((participant) => {
            this.audit(c, participant, {
              action: AuditActionEnum.Update,
              details: {
                ...(body.name === undefined ? {} : { name: participant.name }),
                ...(body.email === undefined
                  ? {}
                  : { email: participant.email }),
              },
            });
            if (participant.name !== target.name) {
              this.regenerate(c, [participant]);
            }
            return participant;
          }),
      );
    if (updated.isErr()) {
      return this.error(
        c,
        updated.error instanceof DuplicateModelError
          ? ApiErrorCodeEnum.ParticipantEmailTaken
          : ApiErrorCodeEnum.NotFound,
      );
    }

    const participant = updated.value;
    return c.json<ParticipantSummary, 200>(
      this.toSummaries([participant])[0]!,
      200,
    );
  }

  // the name goes in the audit entry, since the participant won't be there to look up
  protected async remove(c: Context<CourseEnv>) {
    const target = this.findParticipant(c);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);
    // the row goes with the participant, the file after
    const certificate = this.database
      .getRepositories()
      .certificates.findByParticipant(target.id);

    const deleted = this.database
      .getUnitOfWork()
      .transaction(({ participants }) =>
        participants.delete(target.id).map(() => {
          this.audit(c, target, {
            action: AuditActionEnum.Delete,
            details: {
              name: target.name,
              email: target.email,
            },
          });
        }),
      );
    if (deleted.isErr()) return this.error(c, ApiErrorCodeEnum.NotFound);

    if (certificate) await this.certificates.deleteFile(certificate);
    return c.body(null, 204);
  }

  // each certificate keeps its code and template version; only the name changes
  protected regenerate(
    c: Context<CourseEnv>,
    renamed: readonly Participant[],
  ): void {
    const issued = this.database
      .getRepositories()
      .certificates.listByParticipants(
        renamed.map((participant) => participant.id),
      );
    this.regenerator.queueAll(issued, c.get('user').id);
  }

  // only a participant of the course in the path
  protected findParticipant(c: Context<CourseEnv>): Participant | null {
    const id = ParticipantRoutes.parseId(c.req.param('id'));
    if (id === null) return null;

    const participant = this.database
      .getRepositories()
      .participants.findById(id as ParticipantId);
    return participant?.courseId === c.get('course').id ? participant : null;
  }

  protected audit(
    c: Context<CourseEnv>,
    target: Participant,
    change: AuditChange<typeof AuditEntityEnum.Participant>,
  ): void {
    this.auditLog.record({
      userId: c.get('user').id,
      entity: AuditEntityEnum.Participant,
      entityId: target.id,
      ...change,
    });
  }

  // two queries for the whole page, not two per participant
  protected toSummaries(
    participants: readonly Participant[],
  ): ParticipantSummary[] {
    const { certificates, templateVersions } = this.database.getRepositories();
    const issued = certificates.listByParticipants(
      participants.map((participant) => participant.id),
    );
    const byParticipant = new Map(
      issued.map((certificate) => [certificate.participantId, certificate]),
    );
    const versions = templateVersions.findVersionNumbers([
      ...new Set(issued.map((certificate) => certificate.templateVersionId)),
    ]);

    return participants.map((participant) => {
      const certificate = byParticipant.get(participant.id);
      return {
        id: participant.id,
        courseId: participant.courseId,
        name: participant.name,
        email: participant.email,
        extra: participant.extra,
        certificate: certificate
          ? {
              id: certificate.id,
              code: certificate.code,
              status: certificate.status,
              templateVersion: versions.get(certificate.templateVersionId) ?? 0,
              issueDate: certificate.issueDate,
              revokedReason: certificate.revokedReason,
            }
          : null,
        createdAt: participant.createdAt.toISOString(),
      };
    });
  }
}

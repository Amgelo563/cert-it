import { DuplicateModelError } from '@cert-it/data';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type ApiPage,
  type AuditAction,
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
import type { AuditLogService } from '../audit/AuditLogService';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { Course, CourseId } from '../course/Course';
import type { DatabaseService } from '../database/DatabaseService';
import { apiError } from '../http/api/apiError';
import { apiValidator } from '../http/api/apiValidator';
import { jsonBodyLimit } from '../http/api/jsonBodyLimit';
import { normalizeEmail } from '../util/email/NormalizedEmail';
import { ParticipantImporter } from './import/ParticipantImporter';
import type { Participant, ParticipantId } from './Participant';

type ParticipantServiceOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  auditLog: AuditLogService;
  /** @default a ParticipantImporter on the same database */
  importer?: ParticipantImporter;
};

/** Serves a course's participant routes: anyone can read them, Editors change them and Admins delete them. */
export class ParticipantService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/participants';

  // a full import of MaxImportRows rows, with room for long names and extra columns
  protected static readonly MaxImportBytes = 4 * 1024 * 1024;

  protected static readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.ParticipantEmailTaken]: 409,
  };

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly auditLog: AuditLogService;

  protected readonly importer: ParticipantImporter;

  protected readonly app: ReturnType<ParticipantService['createApp']>;

  constructor(options: ParticipantServiceOptions) {
    this.database = options.database;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.importer =
      options.importer
      ?? new ParticipantImporter({ database: options.database });
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    guard: AuthGuard;
    auditLog: AuditLogService;
    injections?: Partial<ParticipantServiceOptions>;
  }): ParticipantService {
    const { injections } = options;

    return new ParticipantService({
      database: injections?.database ?? options.database,
      guard: injections?.guard ?? options.guard,
      auditLog: injections?.auditLog ?? options.auditLog,
    });
  }

  /** Returns the routes, to mount at {@link ParticipantService.Path}. */
  public getApp(): ParticipantService['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<AuthEnv>({ strict: false })
      .use(guard.authenticate())
      .get(
        '/',
        guard.requirePermission(PermissionEnum.ViewRecords),
        apiValidator('query', ParticipantListQuerySchema),
        (c) => this.list(c, c.req.valid('query')),
      )
      .post(
        '/',
        guard.requirePermission(PermissionEnum.EditParticipants),
        jsonBodyLimit(),
        apiValidator('json', CreateParticipantRequestSchema),
        (c) => this.add(c, c.req.valid('json')),
      )
      .patch(
        '/:id',
        guard.requirePermission(PermissionEnum.EditParticipants),
        jsonBodyLimit(),
        apiValidator('json', UpdateParticipantRequestSchema),
        (c) => this.update(c, c.req.valid('json')),
      )
      .post(
        '/import',
        guard.requirePermission(PermissionEnum.EditParticipants),
        jsonBodyLimit(ParticipantService.MaxImportBytes),
        apiValidator('json', ImportParticipantsRequestSchema),
        (c) => this.import(c, c.req.valid('json')),
      )
      .delete(
        '/:id',
        guard.requirePermission(PermissionEnum.DeleteRecords),
        (c) => this.remove(c),
      );
  }

  // one audit entry for the whole import, and none for a dry run
  protected import(c: Context<AuthEnv>, body: ImportParticipantsRequest) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const result = this.importer.run({
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
        details: { mode: body.mode, ...result.totals },
      });
    }
    return c.json<ImportParticipantsResponse, 200>(result, 200);
  }

  protected list(c: Context<AuthEnv>, query: ParticipantListQuery) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const { search, ...page } = query;
    const participants = this.database
      .getRepositories()
      .participants.listByCourse(course.id, page, search);
    return c.json<ApiPage<ParticipantSummary>, 200>(
      { ...participants, items: this.toSummaries(participants.items) },
      200,
    );
  }

  protected add(c: Context<AuthEnv>, body: CreateParticipantRequest) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const created = this.database.getRepositories().participants.create({
      courseId: course.id,
      name: body.name,
      email: normalizeEmail(body.email),
    });
    if (created.isErr()) {
      return this.error(c, ApiErrorCodeEnum.ParticipantEmailTaken);
    }

    const participant = created.value;
    this.audit(c, participant, AuditActionEnum.Create, {
      email: participant.email,
    });
    return c.json<ParticipantSummary, 201>(
      this.toSummaries([participant])[0]!,
      201,
    );
  }

  protected update(c: Context<AuthEnv>, body: UpdateParticipantRequest) {
    const target = this.findParticipant(c);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);

    const updated = this.database
      .getRepositories()
      .participants.update(target.id, {
        name: body.name,
        email:
          body.email === undefined ? undefined : normalizeEmail(body.email),
      });
    if (updated.isErr()) {
      return this.error(
        c,
        updated.error instanceof DuplicateModelError
          ? ApiErrorCodeEnum.ParticipantEmailTaken
          : ApiErrorCodeEnum.NotFound,
      );
    }

    const participant = updated.value;
    this.audit(c, participant, AuditActionEnum.Update, {
      ...(body.name === undefined ? {} : { name: participant.name }),
      ...(body.email === undefined ? {} : { email: participant.email }),
    });
    return c.json<ParticipantSummary, 200>(
      this.toSummaries([participant])[0]!,
      200,
    );
  }

  // the name goes in the audit entry, since the participant won't be there to look up
  protected remove(c: Context<AuthEnv>) {
    const target = this.findParticipant(c);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);

    const deleted = this.database
      .getRepositories()
      .participants.delete(target.id);
    if (deleted.isErr()) return this.error(c, ApiErrorCodeEnum.NotFound);

    this.audit(c, target, AuditActionEnum.Delete, {
      name: target.name,
      email: target.email,
    });
    return c.body(null, 204);
  }

  protected findCourse(c: Context<AuthEnv>): Course | null {
    const id = ParticipantService.parseId(c.req.param('courseId'));
    if (id === null) return null;
    return this.database.getRepositories().courses.findById(id as CourseId);
  }

  // only a participant of the course in the path
  protected findParticipant(c: Context<AuthEnv>): Participant | null {
    const courseId = ParticipantService.parseId(c.req.param('courseId'));
    const id = ParticipantService.parseId(c.req.param('id'));
    if (courseId === null || id === null) return null;

    const participant = this.database
      .getRepositories()
      .participants.findById(id as ParticipantId);
    return participant?.courseId === courseId ? participant : null;
  }

  protected audit(
    c: Context<AuthEnv>,
    target: Participant,
    action: AuditAction,
    details?: Readonly<Record<string, unknown>>,
  ): void {
    this.auditLog.record({
      userId: c.get('user').id,
      action,
      entity: AuditEntityEnum.Participant,
      entityId: target.id,
      details,
    });
  }

  protected error(c: Context<AuthEnv>, code: ApiErrorCode) {
    return apiError(c, ParticipantService.ErrorStatuses[code] ?? 400, code);
  }

  protected static parseId(value: string | undefined): number | null {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
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
            }
          : null,
        createdAt: participant.createdAt.toISOString(),
      };
    });
  }
}

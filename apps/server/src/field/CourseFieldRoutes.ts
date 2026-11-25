import { DuplicateModelError } from '@cert-it/data';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  AuditActionEnum,
  type AuditChange,
  AuditEntityEnum,
  type CourseFieldSummary,
  CourseFieldTypeEnum,
  type CreateCourseFieldRequest,
  CreateCourseFieldRequestSchema,
  fieldLabelKey,
  listCourseFieldIds,
  MaxCourseFields,
  PermissionEnum,
  type ReorderCourseFieldsRequest,
  ReorderCourseFieldsRequestSchema,
  type TemplateContent,
  type UpdateCourseFieldRequest,
  UpdateCourseFieldRequestSchema,
  withoutCourseField,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuditLog } from '../audit/AuditLog';
import type { AuthGuard } from '../auth/AuthGuard';
import type { Course } from '../course/Course';
import type { CourseEnv } from '../course/CourseEnv';
import { CourseLoader } from '../course/CourseLoader';
import type { DatabaseService } from '../database/DatabaseService';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import type { TemplateVersion } from '../template/TemplateVersion';
import { TemplateVersionWriter } from '../template/TemplateVersionWriter';
import type { UserId } from '../user/User';
import type { CourseField, CourseFieldId } from './CourseField';

type CourseFieldRoutesOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  courseLoader: CourseLoader;
  auditLog: AuditLog;
  /** Saves the template without a field that's deleted or can no longer be printed. */
  writer: TemplateVersionWriter;
};

/** Serves a course's field routes: anyone can read them, Editors change them. */
export class CourseFieldRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/fields';

  protected static override readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.FieldLabelTaken]: 409,
    [ApiErrorCodeEnum.TooManyFields]: 409,
    [ApiErrorCodeEnum.FieldHasValues]: 409,
  };

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly courseLoader: CourseLoader;

  protected readonly auditLog: AuditLog;

  protected readonly writer: TemplateVersionWriter;

  protected readonly app: ReturnType<CourseFieldRoutes['createApp']>;

  constructor(options: CourseFieldRoutesOptions) {
    super();
    this.database = options.database;
    this.guard = options.guard;
    this.courseLoader = options.courseLoader;
    this.auditLog = options.auditLog;
    this.writer = options.writer;
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    guard: AuthGuard;
    auditLog: AuditLog;
    injections?: Partial<
      Pick<CourseFieldRoutesOptions, 'courseLoader' | 'writer'>
    >;
  }): CourseFieldRoutes {
    const { injections, ...shared } = options;

    return new CourseFieldRoutes({
      ...shared,
      courseLoader:
        injections?.courseLoader
        ?? CourseLoader.create({ database: shared.database }),
      writer:
        injections?.writer
        ?? new TemplateVersionWriter({
          database: shared.database,
          auditLog: shared.auditLog,
        }),
    });
  }

  /** Returns the routes, to mount at {@link CourseFieldRoutes.Path}. */
  public getApp(): CourseFieldRoutes['app'] {
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
        this.courseLoader.middleware(),
        (c) => c.json<CourseFieldSummary[], 200>(this.listSummaries(c), 200),
      )
      .post(
        '/',
        guard.requirePermission(PermissionEnum.EditCourses),
        CourseFieldRoutes.bodyLimit(),
        CourseFieldRoutes.validator('json', CreateCourseFieldRequestSchema),
        this.courseLoader.middleware(),
        (c) => this.add(c, c.req.valid('json')),
      )
      .put(
        '/order',
        guard.requirePermission(PermissionEnum.EditCourses),
        CourseFieldRoutes.bodyLimit(),
        CourseFieldRoutes.validator('json', ReorderCourseFieldsRequestSchema),
        this.courseLoader.middleware(),
        (c) => this.reorder(c, c.req.valid('json')),
      )
      .patch(
        '/:id',
        guard.requirePermission(PermissionEnum.EditCourses),
        CourseFieldRoutes.bodyLimit(),
        CourseFieldRoutes.validator('json', UpdateCourseFieldRequestSchema),
        this.courseLoader.middleware(),
        (c) => this.update(c, c.req.valid('json')),
      )
      .delete(
        '/:id',
        guard.requirePermission(PermissionEnum.EditCourses),
        this.courseLoader.middleware(),
        (c) => this.remove(c),
      );
  }

  protected add(c: Context<CourseEnv>, body: CreateCourseFieldRequest) {
    const course = c.get('course');
    const userId = c.get('user').id;

    const created = this.database.atomically(() => {
      const { courseFields } = this.database.getRepositories();
      const existing = courseFields.listByCourse(course.id);
      if (existing.length >= MaxCourseFields) {
        return ApiErrorCodeEnum.TooManyFields;
      }

      const result = courseFields.create({
        courseId: course.id,
        label: body.label,
        labelKey: fieldLabelKey(body.label),
        type: body.type,
        required: body.required,
        position: Math.max(-1, ...existing.map((field) => field.position)) + 1,
      });
      if (result.isErr()) return ApiErrorCodeEnum.FieldLabelTaken;

      const field = result.value;
      this.audit(userId, field, {
        action: AuditActionEnum.Create,
        details: {
          courseId: course.id,
          label: field.label,
          type: field.type,
          required: field.required,
        },
      });
      return field;
    });
    if (typeof created === 'string') return this.error(c, created);

    return c.json<CourseFieldSummary, 201>(this.toSummary(created, 0), 201);
  }

  protected update(c: Context<CourseEnv>, body: UpdateCourseFieldRequest) {
    const course = c.get('course');
    const target = this.findField(c);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);
    const userId = c.get('user').id;

    const updated = this.database.atomically(() => {
      const { courseFields, participants } = this.database.getRepositories();
      const values =
        participants.countFieldValues(course.id).get(String(target.id)) ?? 0;
      const retyped = body.type !== undefined && body.type !== target.type;
      if (retyped && values > 0) return ApiErrorCodeEnum.FieldHasValues;

      const result = courseFields.update(target.id, {
        label: body.label,
        labelKey:
          body.label === undefined ? undefined : fieldLabelKey(body.label),
        type: body.type,
        required: body.required,
      });
      if (result.isErr()) {
        return result.error instanceof DuplicateModelError
          ? ApiErrorCodeEnum.FieldLabelTaken
          : ApiErrorCodeEnum.NotFound;
      }

      const field = result.value;
      // an image field can't print as text, nor text as an image
      const image = (type: CourseField['type']) =>
        type === CourseFieldTypeEnum.Image;
      if (retyped && image(field.type) !== image(target.type)) {
        this.dropFromTemplate(course, field, userId);
      }
      this.audit(userId, field, {
        action: AuditActionEnum.Update,
        details: {
          courseId: course.id,
          ...(body.label === undefined ? {} : { label: field.label }),
          ...(retyped ? { type: field.type } : {}),
          ...(body.required === undefined ? {} : { required: field.required }),
        },
      });
      return { field, values };
    });
    if (typeof updated === 'string') return this.error(c, updated);

    return c.json<CourseFieldSummary, 200>(
      this.toSummary(updated.field, updated.values),
      200,
    );
  }

  // every field of the course, each once
  protected reorder(c: Context<CourseEnv>, body: ReorderCourseFieldsRequest) {
    const course = c.get('course');
    const userId = c.get('user').id;

    const reordered = this.database.atomically(() => {
      const { courseFields } = this.database.getRepositories();
      const fields = courseFields.listByCourse(course.id);
      const byId = new Map(fields.map((field) => [field.id as number, field]));
      const ids = new Set(body.ids);
      if (
        ids.size !== body.ids.length
        || ids.size !== fields.length
        || body.ids.some((id) => !byId.has(id))
      ) {
        return null;
      }

      body.ids.forEach((id, position) => {
        courseFields.update(id as CourseFieldId, { position }).unwrap();
      });
      this.auditLog.record({
        userId,
        action: AuditActionEnum.Reorder,
        entity: AuditEntityEnum.Course,
        entityId: course.id,
        details: { fields: body.ids.map((id) => byId.get(id)?.label ?? '') },
      });
      return true;
    });
    if (!reordered) return this.error(c, ApiErrorCodeEnum.InvalidRequest);

    return c.json<CourseFieldSummary[], 200>(this.listSummaries(c), 200);
  }

  // the values go with the field; certificates keep what they printed until regenerated
  protected remove(c: Context<CourseEnv>) {
    const course = c.get('course');
    const target = this.findField(c);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);
    const userId = c.get('user').id;

    this.database.atomically(() => {
      const { courseFields, participants } = this.database.getRepositories();
      const values = participants.removeFieldValue(course.id, target.id);
      courseFields.delete(target.id).unwrap();
      const version = this.dropFromTemplate(course, target, userId);
      this.audit(userId, target, {
        action: AuditActionEnum.Delete,
        details: {
          courseId: course.id,
          label: target.label,
          values,
          ...(version ? { templateVersion: version.version } : {}),
        },
      });
    });
    return c.body(null, 204);
  }

  /**
   * Saves the course's template as a new version without the fields that print the given one, so its certificates show as outdated.
   *
   * @returns The new version, or null if the latest one doesn't print the field.
   */
  protected dropFromTemplate(
    course: Course,
    field: CourseField,
    userId: UserId,
  ): TemplateVersion | null {
    const latest = this.database
      .getRepositories()
      .templateVersions.findLatest(course.id);
    if (
      !latest
      || !listCourseFieldIds(latest.template as TemplateContent).has(field.id)
    ) {
      return null;
    }

    return this.writer.save({
      courseId: course.id,
      template: withoutCourseField(
        latest.template as TemplateContent,
        field.id,
      ),
      basePdfPath: latest.basePdfPath,
      userId,
    });
  }

  protected listSummaries(c: Context<CourseEnv>): CourseFieldSummary[] {
    const course = c.get('course');
    const { courseFields, participants } = this.database.getRepositories();
    const counts = participants.countFieldValues(course.id);

    return courseFields
      .listByCourse(course.id)
      .map((field) => this.toSummary(field, counts.get(String(field.id)) ?? 0));
  }

  // only a field of the course in the path
  protected findField(c: Context<CourseEnv>): CourseField | null {
    const id = CourseFieldRoutes.parseId(c.req.param('id'));
    if (id === null) return null;

    const field = this.database
      .getRepositories()
      .courseFields.findById(id as CourseFieldId);
    return field?.courseId === c.get('course').id ? field : null;
  }

  protected audit(
    userId: UserId,
    target: CourseField,
    change: AuditChange<typeof AuditEntityEnum.CourseField>,
  ): void {
    this.auditLog.record({
      userId,
      entity: AuditEntityEnum.CourseField,
      entityId: target.id,
      ...change,
    });
  }

  protected toSummary(
    field: CourseField,
    valueCount: number,
  ): CourseFieldSummary {
    return {
      id: field.id,
      courseId: field.courseId,
      label: field.label,
      type: field.type,
      required: field.required,
      position: field.position,
      valueCount,
    };
  }
}

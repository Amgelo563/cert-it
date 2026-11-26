import {
  type ApiPage,
  AuditEntityEnum,
  type AuditEntrySummary,
  type PageQuery,
  PageQuerySchema,
  PermissionEnum,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { CourseId } from '../course/Course';
import type { ParticipantId } from '../participant/Participant';
import type { DatabaseService } from '../database/DatabaseService';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import type { User, UserId } from '../user/User';
import type { AuditEntry } from './AuditEntry';

type AuditLogRoutesOptions = {
  database: DatabaseService;
  guard: AuthGuard;
};

/** Serves the Admin-only audit log route. */
export class AuditLogRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/audit';

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly app: ReturnType<AuditLogRoutes['createApp']>;

  constructor(options: AuditLogRoutesOptions) {
    super();
    this.database = options.database;
    this.guard = options.guard;
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    guard: AuthGuard;
  }): AuditLogRoutes {
    return new AuditLogRoutes(options);
  }

  /** Returns the routes, to mount at {@link AuditLogRoutes.Path}. */
  public getApp(): AuditLogRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    return new Hono<AuthEnv>({ strict: false })
      .use(
        this.guard.authenticate(),
        this.guard.requirePermission(PermissionEnum.ViewAuditLog),
      )
      .get('/', AuditLogRoutes.validator('query', PageQuerySchema), (c) =>
        this.list(c, c.req.valid('query')),
      );
  }

  protected list(c: Context<AuthEnv>, query: PageQuery) {
    const { auditLog, users, courses, participants } =
      this.database.getRepositories();
    const page = auditLog.list(query);
    // a page shows few users, so one lookup per distinct ID is enough
    const found = new Map<number, User | null>();
    const userOf = (id: number): User | null => {
      if (!found.has(id)) found.set(id, users.findById(id as UserId));
      return found.get(id) ?? null;
    };
    const names = new Map<string, string | null>();
    const cachedName = (key: string, find: () => string | null) => {
      if (!names.has(key)) names.set(key, find());
      return names.get(key) ?? null;
    };

    const courseName = (id: number): string | null =>
      cachedName(
        `course:${id}`,
        () => courses.findById(id as CourseId)?.name ?? null,
      );

    // deleted models keep their name in the entry's details
    const nameOf = (entry: AuditEntry): string | null => {
      // jobs and templates are named after their course
      if (
        entry.entity === AuditEntityEnum.Job
        || entry.entity === AuditEntityEnum.TemplateVersion
      ) {
        return courseName(entry.details.courseId);
      }
      if (entry.entity === AuditEntityEnum.Font) {
        return `${entry.details.family} ${entry.details.style}`;
      }
      const current =
        entry.entity === AuditEntityEnum.User
          ? (userOf(entry.entityId)?.name ?? null)
          : entry.entity === AuditEntityEnum.Course
            ? courseName(entry.entityId)
            : entry.entity === AuditEntityEnum.Participant
              ? cachedName(
                  `participant:${entry.entityId}`,
                  () =>
                    participants.findById(entry.entityId as ParticipantId)?.name
                    ?? null,
                )
              : null;
      const kept = 'name' in entry.details ? entry.details.name : undefined;
      return current ?? kept ?? null;
    };

    return c.json<ApiPage<AuditEntrySummary>, 200>(
      {
        ...page,
        // spread whole, so each entry keeps its action and details paired
        items: page.items.map((entry) => ({
          ...entry,
          createdAt: entry.createdAt.toISOString(),
          userEmail:
            entry.userId === null
              ? null
              : (userOf(entry.userId)?.email ?? null),
          userName:
            entry.userId === null ? null : (userOf(entry.userId)?.name ?? null),
          entityName: nameOf(entry),
        })),
      },
      200,
    );
  }
}

import {
  type ApiPage,
  type AuditAction,
  type AuditEntity,
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
import type { DatabaseService } from '../database/DatabaseService';
import { apiValidator } from '../http/api/apiValidator';
import type { UserId } from '../user/User';
import type { AuditEntry } from './AuditEntry';

type AuditLogServiceOptions = {
  database: DatabaseService;
  guard: AuthGuard;
};

/** Records changes in the audit log and serves the Admin-only audit log route. */
export class AuditLogService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/audit';

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly app: ReturnType<AuditLogService['createApp']>;

  constructor(options: AuditLogServiceOptions) {
    this.database = options.database;
    this.guard = options.guard;
    this.app = this.createApp();
  }

  protected static toSummary(
    entry: AuditEntry,
  ): Omit<AuditEntrySummary, 'userEmail' | 'entityName'> {
    return {
      id: entry.id,
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      details: entry.details,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  /** Appends an entry to the audit log. */
  public record(entry: {
    /** The user who made the change, or null if the app made it on its own. */
    userId: UserId | null;
    action: AuditAction;
    entity: AuditEntity;
    entityId: number;
    details?: Readonly<Record<string, unknown>>;
  }): AuditEntry {
    return this.database.getRepositories().auditLog.create(entry).unwrap();
  }

  /** Returns the routes, to mount at {@link AuditLogService.Path}. */
  public getApp(): AuditLogService['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    return new Hono<AuthEnv>({ strict: false })
      .use(
        this.guard.authenticate(),
        this.guard.requirePermission(PermissionEnum.ViewAuditLog),
      )
      .get('/', apiValidator('query', PageQuerySchema), (c) =>
        this.list(c, c.req.valid('query')),
      );
  }

  protected list(c: Context<AuthEnv>, query: PageQuery) {
    const { auditLog, users, courses } = this.database.getRepositories();
    const page = auditLog.list(query);
    // a page shows few users, so one lookup per distinct ID is enough
    const emails = new Map<number, string | null>();
    const emailOf = (id: number): string | null => {
      if (!emails.has(id)) {
        emails.set(id, users.findById(id as UserId)?.email ?? null);
      }
      return emails.get(id) ?? null;
    };
    const courseNames = new Map<number, string | null>();
    const courseNameOf = (id: number): string | null => {
      if (!courseNames.has(id)) {
        courseNames.set(id, courses.findById(id as CourseId)?.name ?? null);
      }
      return courseNames.get(id) ?? null;
    };

    const nameOf = (entry: AuditEntry): string | null => {
      const current =
        entry.entity === AuditEntityEnum.User
          ? emailOf(entry.entityId)
          : entry.entity === AuditEntityEnum.Course
            ? courseNameOf(entry.entityId)
            : null;
      const kept = entry.details['name'];
      return current ?? (typeof kept === 'string' ? kept : null);
    };

    return c.json<ApiPage<AuditEntrySummary>, 200>(
      {
        ...page,
        items: page.items.map((entry) => ({
          ...AuditLogService.toSummary(entry),
          userEmail: entry.userId === null ? null : emailOf(entry.userId),
          entityName: nameOf(entry),
        })),
      },
      200,
    );
  }
}

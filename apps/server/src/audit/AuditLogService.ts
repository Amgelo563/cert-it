import {
  ApiErrorCodeEnum,
  type ApiPage,
  type AuditAction,
  type AuditEntity,
  type AuditEntrySummary,
  PageQuerySchema,
  PermissionEnum,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { DatabaseService } from '../database/DatabaseService';
import { apiError } from '../http/api/apiError';
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

  protected readonly app: Hono<AuthEnv>;

  constructor(options: AuditLogServiceOptions) {
    this.database = options.database;
    this.guard = options.guard;
    this.app = this.createApp();
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
  public getApp(): Hono<AuthEnv> {
    return this.app;
  }

  protected createApp(): Hono<AuthEnv> {
    const app = new Hono<AuthEnv>({ strict: false });

    app.use(
      this.guard.authenticate(),
      this.guard.requirePermission(PermissionEnum.ViewAuditLog),
    );
    app.get('/', (c) => this.list(c));

    return app;
  }

  protected list(c: Context<AuthEnv>): Response {
    const query = PageQuerySchema.safeParse(c.req.query());
    if (!query.success) {
      return apiError(c, 400, ApiErrorCodeEnum.InvalidRequest);
    }

    const page = this.database.getRepositories().auditLog.list(query.data);
    return c.json<ApiPage<AuditEntrySummary>>({
      ...page,
      items: page.items.map((entry) => AuditLogService.toSummary(entry)),
    });
  }

  protected static toSummary(entry: AuditEntry): AuditEntrySummary {
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
}

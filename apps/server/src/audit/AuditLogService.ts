import {
  type ApiPage,
  type AuditAction,
  type AuditEntity,
  type AuditEntrySummary,
  type PageQuery,
  PageQuerySchema,
  PermissionEnum,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
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
    const page = this.database.getRepositories().auditLog.list(query);
    return c.json<ApiPage<AuditEntrySummary>, 200>(
      {
        ...page,
        items: page.items.map((entry) => AuditLogService.toSummary(entry)),
      },
      200,
    );
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

import { ModelNotFoundError } from '@cert-it/data';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type ApiPage,
  type AuditAction,
  AuditActionEnum,
  AuditEntityEnum,
  type CreatedUserResponse,
  type CreateUserRequest,
  CreateUserRequestSchema,
  type PageQuery,
  PageQuerySchema,
  PermissionEnum,
  type ResetPasswordResponse,
  RoleEnum,
  type UpdateUserRequest,
  UpdateUserRequestSchema,
  type UserSummary,
} from '@cert-it/shared';
import { Result } from 'better-result';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuditLogService } from '../audit/AuditLogService';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { PasswordHasher } from '../auth/password/PasswordHasher';
import type { SessionService } from '../auth/session/SessionService';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { apiError } from '../http/api/apiError';
import { apiValidator } from '../http/api/apiValidator';
import { jsonBodyLimit } from '../http/api/jsonBodyLimit';
import { normalizeEmail } from '../util/email/NormalizedEmail';
import type { User, UserId } from './User';

type UserServiceOptions = {
  database: DatabaseService;
  passwords: PasswordHasher;
  sessions: SessionService;
  guard: AuthGuard;
  auditLog: AuditLogService;
  /** Email of the first Admin, as in admin.email. */
  firstAdminEmail: string;
  /** @default console.log */
  log?: (line: string) => void;
};

/** Creates the first Admin and serves the Admin-only user management routes. */
export class UserService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/users';

  protected static readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.EmailTaken]: 409,
    [ApiErrorCodeEnum.LastAdmin]: 409,
    [ApiErrorCodeEnum.OwnAccount]: 409,
  };

  protected readonly database: DatabaseService;

  protected readonly passwords: PasswordHasher;

  protected readonly sessions: SessionService;

  protected readonly guard: AuthGuard;

  protected readonly auditLog: AuditLogService;

  protected readonly firstAdminEmail: string;

  protected readonly log: (line: string) => void;

  protected readonly app: ReturnType<UserService['createApp']>;

  constructor(options: UserServiceOptions) {
    this.database = options.database;
    this.passwords = options.passwords;
    this.sessions = options.sessions;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.firstAdminEmail = options.firstAdminEmail;
    this.log = options.log ?? console.log;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    passwords: PasswordHasher;
    sessions: SessionService;
    guard: AuthGuard;
    auditLog: AuditLogService;
    injections?: Partial<UserServiceOptions>;
  }): UserService {
    const { config, injections } = options;

    return new UserService({
      database: injections?.database ?? options.database,
      passwords: injections?.passwords ?? options.passwords,
      sessions: injections?.sessions ?? options.sessions,
      guard: injections?.guard ?? options.guard,
      auditLog: injections?.auditLog ?? options.auditLog,
      firstAdminEmail: injections?.firstAdminEmail ?? config.admin.email,
      log: injections?.log,
    });
  }

  /** Creates the first Admin when there are no users, printing its random password once. */
  public async start(): Promise<void> {
    const { users } = this.database.getRepositories();
    if (users.count() > 0) return;

    const password = this.passwords.generate();
    const passwordHash = await this.passwords.hash(password);
    const admin = users
      .create({
        email: normalizeEmail(this.firstAdminEmail),
        passwordHash,
        role: RoleEnum.Admin,
        mustChangePassword: true,
      })
      .unwrap();

    this.log(
      `Created the first Admin, ${admin.email}, with the password ${password} (to change at first login)`,
    );
  }

  /** Returns the routes, to mount at {@link UserService.Path}. */
  public getApp(): UserService['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    return new Hono<AuthEnv>({ strict: false })
      .use(
        jsonBodyLimit(),
        this.guard.authenticate(),
        this.guard.requirePermission(PermissionEnum.ManageUsers),
      )
      .get('/', apiValidator('query', PageQuerySchema), (c) =>
        this.list(c, c.req.valid('query')),
      )
      .post('/', apiValidator('json', CreateUserRequestSchema), (c) =>
        this.add(c, c.req.valid('json')),
      )
      .patch('/:id', apiValidator('json', UpdateUserRequestSchema), (c) =>
        this.update(c, c.req.valid('json')),
      )
      .post('/:id/reset-password', (c) => this.resetPassword(c));
  }

  protected list(c: Context<AuthEnv>, query: PageQuery) {
    const page = this.database.getRepositories().users.list(query);
    return c.json<ApiPage<UserSummary>, 200>(
      {
        ...page,
        items: page.items.map((user) => UserService.toSummary(user)),
      },
      200,
    );
  }

  // the password is only ever shown in this response
  protected async add(c: Context<AuthEnv>, body: CreateUserRequest) {
    const password = this.passwords.generate();
    const created = this.database.getRepositories().users.create({
      email: normalizeEmail(body.email),
      passwordHash: await this.passwords.hash(password),
      role: body.role,
      mustChangePassword: true,
    });
    if (created.isErr()) {
      return apiError(c, 409, ApiErrorCodeEnum.EmailTaken);
    }

    const user = created.value;
    this.audit(c, user, AuditActionEnum.Create, { role: user.role });
    return c.json<CreatedUserResponse, 201>(
      { user: UserService.toSummary(user), password },
      201,
    );
  }

  // checked and written in one transaction, so two Admins can't demote each other at once
  protected update(c: Context<AuthEnv>, body: UpdateUserRequest) {
    const id = UserService.parseId(c);

    const result = this.database
      .getUnitOfWork()
      .transaction(({ users }): Result<User, ApiErrorCode> => {
        const target = id === null ? null : users.findById(id);
        if (!target) return Result.err(ApiErrorCodeEnum.NotFound);
        if (target.id === c.get('user').id) {
          return Result.err(ApiErrorCodeEnum.OwnAccount);
        }
        if (
          UserService.losesAdmin(target, body)
          && users.countActiveAdmins() <= 1
        ) {
          return Result.err(ApiErrorCodeEnum.LastAdmin);
        }

        return users
          .update(target.id, body)
          .mapError(() => ApiErrorCodeEnum.NotFound);
      });
    if (result.isErr()) return this.error(c, result.error);

    const user = result.value;
    if (!user.active) this.sessions.endAll(user.id);
    this.audit(c, user, AuditActionEnum.Update, { ...body });
    return c.json<UserSummary, 200>(UserService.toSummary(user), 200);
  }

  // ends the user's sessions, so only the new password works from now on
  protected async resetPassword(c: Context<AuthEnv>) {
    const id = UserService.parseId(c);
    const { users } = this.database.getRepositories();
    const target = id === null ? null : users.findById(id);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);
    if (target.id === c.get('user').id) {
      return this.error(c, ApiErrorCodeEnum.OwnAccount);
    }

    const password = this.passwords.generate();
    const updated = users.update(target.id, {
      passwordHash: await this.passwords.hash(password),
      mustChangePassword: true,
    });
    if (updated.isErr()) {
      if (!(updated.error instanceof ModelNotFoundError)) throw updated.error;
      return this.error(c, ApiErrorCodeEnum.NotFound);
    }

    this.sessions.endAll(target.id);
    this.audit(c, target, AuditActionEnum.ResetPassword);
    return c.json<ResetPasswordResponse, 200>({ password }, 200);
  }

  protected audit(
    c: Context<AuthEnv>,
    target: User,
    action: AuditAction,
    details?: Readonly<Record<string, unknown>>,
  ): void {
    this.auditLog.record({
      userId: c.get('user').id,
      action,
      entity: AuditEntityEnum.User,
      entityId: target.id,
      details,
    });
  }

  protected error(c: Context<AuthEnv>, code: ApiErrorCode) {
    return apiError(c, UserService.ErrorStatuses[code] ?? 400, code);
  }

  // an active Admin stops counting as one when demoted or deactivated
  protected static losesAdmin(target: User, body: UpdateUserRequest): boolean {
    const isAdmin = target.role === RoleEnum.Admin && target.active;
    const demoted = body.role !== undefined && body.role !== RoleEnum.Admin;
    return isAdmin && (demoted || body.active === false);
  }

  protected static parseId(c: Context): UserId | null {
    const id = Number(c.req.param('id'));
    return Number.isSafeInteger(id) && id > 0 ? (id as UserId) : null;
  }

  protected static toSummary(user: User): UserSummary {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      active: user.active,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

import { ModelNotFoundError } from '@cert-it/data';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type ApiPage,
  type AuditChange,
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
import type { AuditLog } from '../audit/AuditLog';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { PasswordHasher } from '../auth/password/PasswordHasher';
import type { SessionService } from '../auth/session/SessionService';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import { normalizeEmail } from '../util/email/NormalizedEmail';
import type { User, UserId } from './User';
import { MessageCatalog } from '../i18n/MessageCatalog';
import { ConsoleLogger } from '../log/ConsoleLogger';
import type { Logger } from '../log/Logger';

type UserRoutesOptions = {
  database: DatabaseService;
  passwords: PasswordHasher;
  sessions: SessionService;
  guard: AuthGuard;
  auditLog: AuditLog;
  /** Email of the first Admin, as in admin.email. */
  firstAdminEmail: string;
  /** Name of the first Admin, as in admin.name. */
  firstAdminName: string | undefined;
  /** Name given to users without one, in the site's default language. */
  placeholderName: string;
  logger: Logger;
};

/** Creates the first Admin and serves the Admin-only user management routes. */
export class UserRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/users';

  protected static override readonly ErrorStatuses: Partial<
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

  protected readonly auditLog: AuditLog;

  protected readonly firstAdminEmail: string;

  protected readonly firstAdminName: string | undefined;

  protected readonly placeholderName: string;

  protected readonly logger: Logger;

  protected readonly app: ReturnType<UserRoutes['createApp']>;

  constructor(options: UserRoutesOptions) {
    super();
    this.database = options.database;
    this.passwords = options.passwords;
    this.sessions = options.sessions;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.firstAdminEmail = options.firstAdminEmail;
    this.firstAdminName = options.firstAdminName;
    this.placeholderName = options.placeholderName;
    this.logger = options.logger;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'admin' | 'site'>;
    database: DatabaseService;
    passwords: PasswordHasher;
    sessions: SessionService;
    guard: AuthGuard;
    auditLog: AuditLog;
    injections?: Partial<
      Pick<
        UserRoutesOptions,
        'firstAdminEmail' | 'firstAdminName' | 'placeholderName' | 'logger'
      >
    >;
  }): UserRoutes {
    const { config, injections, ...shared } = options;
    const messages = new MessageCatalog().get(config.site.defaultLocale);

    return new UserRoutes({
      ...shared,
      firstAdminEmail: injections?.firstAdminEmail ?? config.admin.email,
      firstAdminName: injections?.firstAdminName ?? config.admin.name,
      placeholderName:
        injections?.placeholderName ?? messages.user.placeholderName,
      logger: injections?.logger ?? ConsoleLogger.Instance,
    });
  }

  /** Names the users that have no name yet, and creates the first Admin when there are no users, printing its random password once. */
  public async start(): Promise<void> {
    const { users } = this.database.getRepositories();
    const named = users.fillMissingNames(this.placeholderName);
    if (named > 0) {
      this.logger.info(
        `Gave ${named} user(s) without a name the name ${this.placeholderName}; rename them from the admin panel`,
      );
    }
    if (users.count() > 0) return;

    const password = this.passwords.generate();
    const passwordHash = await this.passwords.hash(password);
    const admin = users
      .create({
        email: normalizeEmail(this.firstAdminEmail),
        name: this.firstAdminName ?? this.placeholderName,
        passwordHash,
        role: RoleEnum.Admin,
        mustChangePassword: true,
      })
      .unwrap();

    this.logger.info(
      `Created the first Admin, ${admin.email}, with the password ${password} (to change at first login)`,
    );
  }

  /** Returns the routes, to mount at {@link UserRoutes.Path}. */
  public getApp(): UserRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    return new Hono<AuthEnv>({ strict: false })
      .use(
        UserRoutes.bodyLimit(),
        this.guard.authenticate(),
        this.guard.requirePermission(PermissionEnum.ManageUsers),
      )
      .get('/', UserRoutes.validator('query', PageQuerySchema), (c) =>
        this.list(c, c.req.valid('query')),
      )
      .post('/', UserRoutes.validator('json', CreateUserRequestSchema), (c) =>
        this.add(c, c.req.valid('json')),
      )
      .patch(
        '/:id',
        UserRoutes.validator('json', UpdateUserRequestSchema),
        (c) => this.update(c, c.req.valid('json')),
      )
      .post('/:id/reset-password', (c) => this.resetPassword(c));
  }

  protected list(c: Context<AuthEnv>, query: PageQuery) {
    const page = this.database.getRepositories().users.list(query);
    return c.json<ApiPage<UserSummary>, 200>(
      {
        ...page,
        items: page.items.map((user) => UserRoutes.toSummary(user)),
      },
      200,
    );
  }

  // the password is only ever shown in this response
  protected async add(c: Context<AuthEnv>, body: CreateUserRequest) {
    const password = this.passwords.generate();
    const passwordHash = await this.passwords.hash(password);
    const created = this.database.getUnitOfWork().transaction(({ users }) =>
      users
        .create({
          email: normalizeEmail(body.email),
          name: body.name,
          passwordHash,
          role: body.role,
          mustChangePassword: true,
        })
        .map((user) => {
          this.audit(c, user, {
            action: AuditActionEnum.Create,
            details: { name: user.name, role: user.role },
          });
          return user;
        }),
    );
    if (created.isErr()) {
      return UserRoutes.apiError(c, 409, ApiErrorCodeEnum.EmailTaken);
    }

    const user = created.value;
    return c.json<CreatedUserResponse, 201>(
      { user: UserRoutes.toSummary(user), password },
      201,
    );
  }

  // checked and written in one transaction, so two Admins can't demote each other at once
  protected update(c: Context<AuthEnv>, body: UpdateUserRequest) {
    const id = UserRoutes.parseId(c.req.param('id')) as UserId | null;

    const result = this.database
      .getUnitOfWork()
      .transaction(({ users }): Result<User, ApiErrorCode> => {
        const target = id === null ? null : users.findById(id);
        if (!target) return Result.err(ApiErrorCodeEnum.NotFound);
        // users may rename themselves, but not change their own access
        if (
          target.id === c.get('user').id
          && (body.role !== undefined || body.active !== undefined)
        ) {
          return Result.err(ApiErrorCodeEnum.OwnAccount);
        }
        if (
          UserRoutes.losesAdmin(target, body)
          && users.countActiveAdmins() <= 1
        ) {
          return Result.err(ApiErrorCodeEnum.LastAdmin);
        }

        return users
          .update(target.id, body)
          .mapError(() => ApiErrorCodeEnum.NotFound)
          .map((user) => {
            if (!user.active) this.sessions.endAll(user.id);
            this.audit(c, user, {
              action: AuditActionEnum.Update,
              details: { ...body },
            });
            return user;
          });
      });
    if (result.isErr()) return this.error(c, result.error);

    const user = result.value;
    return c.json<UserSummary, 200>(UserRoutes.toSummary(user), 200);
  }

  // ends the user's sessions, so only the new password works from now on
  protected async resetPassword(c: Context<AuthEnv>) {
    const id = UserRoutes.parseId(c.req.param('id')) as UserId | null;
    const { users } = this.database.getRepositories();
    const target = id === null ? null : users.findById(id);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);
    if (target.id === c.get('user').id) {
      return this.error(c, ApiErrorCodeEnum.OwnAccount);
    }

    const password = this.passwords.generate();
    const passwordHash = await this.passwords.hash(password);
    const updated = this.database.getUnitOfWork().transaction((repositories) =>
      repositories.users
        .update(target.id, { passwordHash, mustChangePassword: true })
        .map(() => {
          this.sessions.endAll(target.id);
          this.audit(c, target, {
            action: AuditActionEnum.ResetPassword,
            details: {},
          });
        }),
    );
    if (updated.isErr()) {
      if (!(updated.error instanceof ModelNotFoundError)) throw updated.error;
      return this.error(c, ApiErrorCodeEnum.NotFound);
    }

    return c.json<ResetPasswordResponse, 200>({ password }, 200);
  }

  protected audit(
    c: Context<AuthEnv>,
    target: User,
    change: AuditChange<typeof AuditEntityEnum.User>,
  ): void {
    this.auditLog.record({
      userId: c.get('user').id,
      entity: AuditEntityEnum.User,
      entityId: target.id,
      ...change,
    });
  }

  // an active Admin stops counting as one when demoted or deactivated
  protected static losesAdmin(target: User, body: UpdateUserRequest): boolean {
    const isAdmin = target.role === RoleEnum.Admin && target.active;
    const demoted = body.role !== undefined && body.role !== RoleEnum.Admin;
    return isAdmin && (demoted || body.active === false);
  }

  protected static toSummary(user: User): UserSummary {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

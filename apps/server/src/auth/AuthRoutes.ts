import { RateLimiter } from '@cert-it/hono';
import {
  ApiErrorCodeEnum,
  AuditActionEnum,
  type AuditAction,
  AuditEntityEnum,
  type ChangePasswordRequest,
  ChangePasswordRequestSchema,
  type CurrentUser,
  type LoginRequest,
  LoginRequestSchema,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { AuditLog } from '../audit/AuditLog';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import type { User } from '../user/User';
import { normalizeEmail } from '../util/email/NormalizedEmail';
import type { AuthEnv } from './AuthEnv';
import type { AuthGuard } from './AuthGuard';
import type { PasswordHasher } from './password/PasswordHasher';
import type { SessionService } from './session/SessionService';

type AuthRoutesOptions = {
  database: DatabaseService;
  sessions: SessionService;
  passwords: PasswordHasher;
  guard: AuthGuard;
  auditLog: AuditLog;
  /** Limits login attempts per client IP. */
  ipLimiter: RateLimiter;
  /** Limits password checks per account. */
  accountLimiter: RateLimiter;
};

/** The login, logout, current user and change password routes. */
export class AuthRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/auth';

  protected readonly database: DatabaseService;

  protected readonly sessions: SessionService;

  protected readonly passwords: PasswordHasher;

  protected readonly guard: AuthGuard;

  protected readonly auditLog: AuditLog;

  protected readonly ipLimiter: RateLimiter;

  protected readonly accountLimiter: RateLimiter;

  protected readonly app: ReturnType<AuthRoutes['createApp']>;

  /** Hash checked for unknown emails, so they take as long as known ones. */
  protected dummyHash: Promise<string> | null = null;

  constructor(options: AuthRoutesOptions) {
    super();
    this.database = options.database;
    this.sessions = options.sessions;
    this.passwords = options.passwords;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.ipLimiter = options.ipLimiter;
    this.accountLimiter = options.accountLimiter;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'auth'>;
    database: DatabaseService;
    sessions: SessionService;
    passwords: PasswordHasher;
    guard: AuthGuard;
    auditLog: AuditLog;
    injections?: Partial<
      Pick<AuthRoutesOptions, 'ipLimiter' | 'accountLimiter'>
    >;
  }): AuthRoutes {
    const { config, injections, ...shared } = options;
    const { maxAttempts, windowMinutes } = config.auth.rateLimit;
    const limiter = () =>
      new RateLimiter({
        maxHits: maxAttempts,
        windowMs: windowMinutes * 60 * 1000,
      });

    return new AuthRoutes({
      ...shared,
      ipLimiter: injections?.ipLimiter ?? limiter(),
      accountLimiter: injections?.accountLimiter ?? limiter(),
    });
  }

  /** Returns the routes, to mount at {@link AuthRoutes.Path}. */
  public getApp(): AuthRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const loggedIn = this.guard.authenticate({
      allowPendingPasswordChange: true,
    });

    return new Hono<AuthEnv>({ strict: false })
      .use(AuthRoutes.bodyLimit())
      .post('/login', AuthRoutes.validator('json', LoginRequestSchema), (c) =>
        this.login(c, c.req.valid('json')),
      )
      .post('/logout', (c) => this.logout(c))
      .get('/me', loggedIn, (c) =>
        c.json<CurrentUser, 200>(AuthRoutes.toCurrentUser(c.get('user')), 200),
      )
      .post(
        '/password',
        loggedIn,
        AuthRoutes.validator('json', ChangePasswordRequestSchema),
        (c) => this.changePassword(c, c.req.valid('json')),
      );
  }

  // unknown emails, wrong passwords and deactivated accounts answer alike
  protected async login(c: Context<AuthEnv>, body: LoginRequest) {
    const email = normalizeEmail(body.email);
    const waitSeconds = Math.max(
      this.ipLimiter.hit(c.get('clientIp')),
      this.accountLimiter.hit(email),
    );
    if (waitSeconds > 0) return AuthRoutes.tooManyAttempts(c, waitSeconds);

    const { users } = this.database.getRepositories();
    const user = users.findByEmail(email);
    const passwordHash = user ? users.findPasswordHash(user.id) : null;
    const matches = await this.passwords.verify(
      passwordHash ?? (await this.getDummyHash()),
      body.password,
    );

    if (!user || !passwordHash || !matches || !user.active) {
      return AuthRoutes.apiError(c, 401, ApiErrorCodeEnum.InvalidCredentials);
    }

    this.accountLimiter.reset(email);
    this.database.atomically(() => {
      this.sessions.open(c, user.id);
      this.audit(user, AuditActionEnum.Login);
    });
    return c.json<CurrentUser, 200>(AuthRoutes.toCurrentUser(user), 200);
  }

  protected logout(c: Context<AuthEnv>) {
    this.sessions.end(c);
    return c.body(null, 204);
  }

  // ends every session of the user, then starts a fresh one for this browser
  protected async changePassword(
    c: Context<AuthEnv>,
    body: ChangePasswordRequest,
  ) {
    const user = c.get('user');
    const waitSeconds = this.accountLimiter.hit(user.email);
    if (waitSeconds > 0) return AuthRoutes.tooManyAttempts(c, waitSeconds);

    const { users } = this.database.getRepositories();
    const currentHash = users.findPasswordHash(user.id) ?? '';
    if (!(await this.passwords.verify(currentHash, body.currentPassword))) {
      return AuthRoutes.apiError(c, 400, ApiErrorCodeEnum.WrongPassword);
    }
    if (body.newPassword === body.currentPassword) {
      return AuthRoutes.apiError(c, 400, ApiErrorCodeEnum.SamePassword);
    }

    const passwordHash = await this.passwords.hash(body.newPassword);
    // the new password, its sessions and the audit entry, or none of them
    const updated = this.database.atomically(() => {
      const changed = users
        .update(user.id, { passwordHash, mustChangePassword: false })
        .unwrap();
      this.sessions.endAll(user.id);
      this.sessions.open(c, user.id);
      this.audit(user, AuditActionEnum.ChangePassword);
      return changed;
    });
    this.accountLimiter.reset(user.email);
    return c.json<CurrentUser, 200>(AuthRoutes.toCurrentUser(updated), 200);
  }

  protected audit(user: User, action: AuditAction): void {
    this.auditLog.record({
      userId: user.id,
      action,
      entity: AuditEntityEnum.User,
      entityId: user.id,
    });
  }

  protected getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwords.hash(this.passwords.generate());
    return this.dummyHash;
  }

  protected static tooManyAttempts(c: Context, seconds: number) {
    c.header('Retry-After', String(seconds));
    return AuthRoutes.apiError(c, 429, ApiErrorCodeEnum.TooManyAttempts);
  }

  protected static toCurrentUser(user: User): CurrentUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }
}

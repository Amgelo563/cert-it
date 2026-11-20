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
import type { AuditLogService } from '../audit/AuditLogService';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { apiError } from '../http/api/apiError';
import { apiValidator } from '../http/api/apiValidator';
import { jsonBodyLimit } from '../http/api/jsonBodyLimit';
import type { User } from '../user/User';
import { normalizeEmail } from '../util/email/NormalizedEmail';
import type { AuthEnv } from './AuthEnv';
import type { AuthGuard } from './AuthGuard';
import type { PasswordHasher } from './password/PasswordHasher';
import type { SessionService } from './session/SessionService';

type AuthServiceOptions = {
  database: DatabaseService;
  sessions: SessionService;
  passwords: PasswordHasher;
  guard: AuthGuard;
  auditLog: AuditLogService;
  /** Limits login attempts per client IP. */
  ipLimiter: RateLimiter;
  /** Limits password checks per account. */
  accountLimiter: RateLimiter;
};

/** The login, logout, current user and change password routes. */
export class AuthService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/auth';

  protected readonly database: DatabaseService;

  protected readonly sessions: SessionService;

  protected readonly passwords: PasswordHasher;

  protected readonly guard: AuthGuard;

  protected readonly auditLog: AuditLogService;

  protected readonly ipLimiter: RateLimiter;

  protected readonly accountLimiter: RateLimiter;

  protected readonly app: ReturnType<AuthService['createApp']>;

  /** Hash checked for unknown emails, so they take as long as known ones. */
  protected dummyHash: Promise<string> | null = null;

  constructor(options: AuthServiceOptions) {
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
    config: Config;
    database: DatabaseService;
    sessions: SessionService;
    passwords: PasswordHasher;
    guard: AuthGuard;
    auditLog: AuditLogService;
    injections?: Partial<AuthServiceOptions>;
  }): AuthService {
    const { config, injections } = options;
    const { maxAttempts, windowMinutes } = config.auth.rateLimit;
    const limiter = () =>
      new RateLimiter({
        maxHits: maxAttempts,
        windowMs: windowMinutes * 60 * 1000,
      });

    return new AuthService({
      database: injections?.database ?? options.database,
      sessions: injections?.sessions ?? options.sessions,
      passwords: injections?.passwords ?? options.passwords,
      guard: injections?.guard ?? options.guard,
      auditLog: injections?.auditLog ?? options.auditLog,
      ipLimiter: injections?.ipLimiter ?? limiter(),
      accountLimiter: injections?.accountLimiter ?? limiter(),
    });
  }

  /** Returns the routes, to mount at {@link AuthService.Path}. */
  public getApp(): AuthService['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const loggedIn = this.guard.authenticate({
      allowPendingPasswordChange: true,
    });

    return new Hono<AuthEnv>({ strict: false })
      .use(jsonBodyLimit())
      .post('/login', apiValidator('json', LoginRequestSchema), (c) =>
        this.login(c, c.req.valid('json')),
      )
      .post('/logout', (c) => this.logout(c))
      .get('/me', loggedIn, (c) =>
        c.json<CurrentUser, 200>(AuthService.toCurrentUser(c.get('user')), 200),
      )
      .post(
        '/password',
        loggedIn,
        apiValidator('json', ChangePasswordRequestSchema),
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
    if (waitSeconds > 0) return AuthService.tooManyAttempts(c, waitSeconds);

    const { users } = this.database.getRepositories();
    const user = users.findByEmail(email);
    const passwordHash = user ? users.findPasswordHash(user.id) : null;
    const matches = await this.passwords.verify(
      passwordHash ?? (await this.getDummyHash()),
      body.password,
    );

    if (!user || !passwordHash || !matches || !user.active) {
      return apiError(c, 401, ApiErrorCodeEnum.InvalidCredentials);
    }

    this.accountLimiter.reset(email);
    this.sessions.create(c, user.id);
    this.audit(user, AuditActionEnum.Login);
    return c.json<CurrentUser, 200>(AuthService.toCurrentUser(user), 200);
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
    if (waitSeconds > 0) return AuthService.tooManyAttempts(c, waitSeconds);

    const { users } = this.database.getRepositories();
    const currentHash = users.findPasswordHash(user.id) ?? '';
    if (!(await this.passwords.verify(currentHash, body.currentPassword))) {
      return apiError(c, 400, ApiErrorCodeEnum.WrongPassword);
    }
    if (body.newPassword === body.currentPassword) {
      return apiError(c, 400, ApiErrorCodeEnum.SamePassword);
    }

    const passwordHash = await this.passwords.hash(body.newPassword);
    const updated = users
      .update(user.id, { passwordHash, mustChangePassword: false })
      .unwrap();
    this.accountLimiter.reset(user.email);
    this.sessions.endAll(user.id);
    this.sessions.create(c, user.id);
    this.audit(user, AuditActionEnum.ChangePassword);
    return c.json<CurrentUser, 200>(AuthService.toCurrentUser(updated), 200);
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
    return apiError(c, 429, ApiErrorCodeEnum.TooManyAttempts);
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

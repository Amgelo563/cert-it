import {
  ApiErrorCodeEnum,
  ChangePasswordRequestSchema,
  type CurrentUser,
  LoginRequestSchema,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import { AuditActionEnum, type AuditAction } from '../audit/AuditActionEnum';
import { AuditEntityEnum } from '../audit/AuditEntityEnum';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { apiError } from '../http/api/apiError';
import { jsonBodyLimit } from '../http/api/jsonBodyLimit';
import { parseJson } from '../http/api/parseJson';
import type { User } from '../user/User';
import { normalizeEmail } from '../util/email/NormalizedEmail';
import type { AuthEnv } from './AuthEnv';
import type { AuthGuard } from './AuthGuard';
import type { PasswordHasher } from './password/PasswordHasher';
import { RateLimiter } from './rateLimit/RateLimiter';
import type { SessionService } from './session/SessionService';

type AuthServiceOptions = {
  database: DatabaseService;
  sessions: SessionService;
  passwords: PasswordHasher;
  guard: AuthGuard;
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

  protected readonly ipLimiter: RateLimiter;

  protected readonly accountLimiter: RateLimiter;

  protected readonly app: Hono<AuthEnv>;

  /** Hash checked for unknown emails, so they take as long as known ones. */
  protected dummyHash: Promise<string> | null = null;

  constructor(options: AuthServiceOptions) {
    this.database = options.database;
    this.sessions = options.sessions;
    this.passwords = options.passwords;
    this.guard = options.guard;
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
      ipLimiter: injections?.ipLimiter ?? limiter(),
      accountLimiter: injections?.accountLimiter ?? limiter(),
    });
  }

  /** Returns the routes, to mount at {@link AuthService.Path}. */
  public getApp(): Hono<AuthEnv> {
    return this.app;
  }

  protected createApp(): Hono<AuthEnv> {
    const app = new Hono<AuthEnv>({ strict: false });
    const loggedIn = this.guard.authenticate({
      allowPendingPasswordChange: true,
    });

    app.use(jsonBodyLimit());
    app.post('/login', (c) => this.login(c));
    app.post('/logout', (c) => this.logout(c));
    app.get('/me', loggedIn, (c) =>
      c.json(AuthService.toCurrentUser(c.get('user'))),
    );
    app.post('/password', loggedIn, (c) => this.changePassword(c));

    return app;
  }

  // unknown emails, wrong passwords and deactivated accounts answer alike
  protected async login(c: Context<AuthEnv>): Promise<Response> {
    const body = await parseJson(c, LoginRequestSchema);
    if (!body) return apiError(c, 400, ApiErrorCodeEnum.InvalidRequest);

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
    return c.json(AuthService.toCurrentUser(user));
  }

  protected logout(c: Context<AuthEnv>): Response {
    this.sessions.end(c);
    return c.body(null, 204);
  }

  // ends every session of the user, then starts a fresh one for this browser
  protected async changePassword(c: Context<AuthEnv>): Promise<Response> {
    const body = await parseJson(c, ChangePasswordRequestSchema);
    if (!body) return apiError(c, 400, ApiErrorCodeEnum.InvalidRequest);

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
    return c.json(AuthService.toCurrentUser(updated));
  }

  protected audit(user: User, action: AuditAction): void {
    this.database
      .getRepositories()
      .auditLog.create({
        userId: user.id,
        action,
        entity: AuditEntityEnum.User,
        entityId: user.id,
      })
      .unwrap();
  }

  protected getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwords.hash(this.passwords.generate());
    return this.dummyHash;
  }

  protected static tooManyAttempts(c: Context, seconds: number): Response {
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

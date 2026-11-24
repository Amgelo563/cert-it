import { createHash, randomBytes } from 'node:crypto';
import type { SiteUrl } from '@cert-it/hono';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { DatabaseService } from '../../database/DatabaseService';
import type { User, UserId } from '../../user/User';
import type { Session } from './Session';
import type { Clock } from '../../clock/Clock';
import { SystemClock } from '../../clock/SystemClock';

type SessionServiceOptions = {
  database: DatabaseService;
  siteUrl: SiteUrl;
  /** @default 8 hours */
  lifetimeMs?: number;
  /** @default 30 minutes */
  idleTimeoutMs?: number;
  clock: Clock;
};

/** A session together with its user, for a request that's logged in. */
export type ActiveSession = {
  readonly session: Session;
  readonly user: User;
};

/** Creates, checks and ends admin panel sessions and their cookie. */
export class SessionService {
  public static readonly CookieName = 'cert-it-session';

  /** The cookie's name over HTTPS at the root, where the browser can bind it to the exact host. */
  public static readonly HostCookieName = `__Host-${SessionService.CookieName}`;

  protected static readonly DefaultLifetimeMs = 8 * 60 * 60 * 1000;

  protected static readonly DefaultIdleTimeoutMs = 30 * 60 * 1000;

  protected static readonly TokenBytes = 32;

  // avoids a database write on every request
  protected static readonly MinExtensionMs = 60 * 1000;

  protected static readonly CleanupIntervalMs = 15 * 60 * 1000;

  protected readonly database: DatabaseService;

  protected readonly siteUrl: SiteUrl;

  protected readonly lifetimeMs: number;

  protected readonly idleTimeoutMs: number;

  protected readonly clock: Clock;

  protected readonly cookieName: string;

  protected cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: SessionServiceOptions) {
    this.database = options.database;
    this.siteUrl = options.siteUrl;
    this.lifetimeMs = options.lifetimeMs ?? SessionService.DefaultLifetimeMs;
    this.idleTimeoutMs =
      options.idleTimeoutMs ?? SessionService.DefaultIdleTimeoutMs;
    this.clock = options.clock;
    this.cookieName =
      this.siteUrl.isSecure() && this.siteUrl.getBasePath() === '/'
        ? SessionService.HostCookieName
        : SessionService.CookieName;
  }

  public static create(options: {
    siteUrl: SiteUrl;
    database: DatabaseService;
    injections?: Partial<Omit<SessionServiceOptions, 'database'>>;
  }): SessionService {
    const { siteUrl, database, injections } = options;

    return new SessionService({
      ...injections,
      database,
      siteUrl,
      clock: injections?.clock ?? SystemClock.Instance,
    });
  }

  /** Deletes expired sessions now and periodically after. */
  public start(): void {
    this.deleteExpired();
    this.cleanupTimer = setInterval(
      () => this.deleteExpired(),
      SessionService.CleanupIntervalMs,
    );
    this.cleanupTimer.unref();
  }

  public stop(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  /** Starts a session for the user and sets its cookie, ending the session the browser had, if any. */
  public open(c: Context, userId: UserId): Session {
    this.deletePresented(c);

    const token = randomBytes(SessionService.TokenBytes).toString('base64url');
    const now = this.clock.now().getTime();
    const session = this.database
      .getRepositories()
      .sessions.create({
        tokenHash: SessionService.hashToken(token),
        userId,
        expiresAt: new Date(
          now + Math.min(this.idleTimeoutMs, this.lifetimeMs),
        ),
      })
      .unwrap();

    setCookie(c, this.cookieName, token, {
      path: this.siteUrl.getBasePath(),
      httpOnly: true,
      secure: this.siteUrl.isSecure(),
      sameSite: 'Lax',
      maxAge: Math.floor(this.lifetimeMs / 1000),
    });
    return session;
  }

  /** Returns the request's session and its active user, extending its idle timeout, or null if there's none. */
  public resolve(c: Context): ActiveSession | null {
    const token = getCookie(c, this.cookieName);
    if (!token) return null;

    const { sessions, users } = this.database.getRepositories();
    const session = sessions.findByTokenHash(SessionService.hashToken(token));
    if (!session) return null;

    const now = this.clock.now().getTime();
    const user = users.findById(session.userId);
    if (session.expiresAt.getTime() <= now || !user?.active) {
      sessions.delete(session.id);
      return null;
    }

    return { session: this.extend(session, now), user };
  }

  /** Ends the request's session, if any, and clears its cookie. */
  public end(c: Context): void {
    this.deletePresented(c);
    deleteCookie(c, this.cookieName, {
      path: this.siteUrl.getBasePath(),
      secure: this.siteUrl.isSecure(),
    });
  }

  /** Ends every session of the user, returning how many were ended. */
  public endAll(userId: UserId): number {
    return this.database.getRepositories().sessions.deleteByUser(userId);
  }

  /** Deletes the expired sessions, returning how many were deleted. */
  public deleteExpired(): number {
    return this.database
      .getRepositories()
      .sessions.deleteExpired(new Date(this.clock.now().getTime()));
  }

  protected deletePresented(c: Context): void {
    const token = getCookie(c, this.cookieName);
    if (!token) return;

    const { sessions } = this.database.getRepositories();
    const session = sessions.findByTokenHash(SessionService.hashToken(token));
    if (session) sessions.delete(session.id);
  }

  protected static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // idle timeout slides, capped by the absolute lifetime
  protected extend(session: Session, now: number): Session {
    const expiresAt = Math.min(
      now + this.idleTimeoutMs,
      session.createdAt.getTime() + this.lifetimeMs,
    );
    if (
      expiresAt - session.expiresAt.getTime()
      < SessionService.MinExtensionMs
    ) {
      return session;
    }

    return this.database
      .getRepositories()
      .sessions.update(session.id, { expiresAt: new Date(expiresAt) })
      .unwrap();
  }
}

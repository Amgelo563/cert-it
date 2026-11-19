import { hasPermission, type Permission } from '@cert-it/shared';
import type { Context, MiddlewareHandler } from 'hono';
import type { AuthEnv } from './AuthEnv';
import type { SessionService } from './session/SessionService';

type AuthGuardOptions = {
  sessions: SessionService;
};

/** Middleware that requires a logged-in user and checks their role. */
export class AuthGuard {
  public static readonly UnauthorizedCode = 'unauthorized';

  public static readonly ForbiddenCode = 'forbidden';

  protected readonly sessions: SessionService;

  constructor(options: AuthGuardOptions) {
    this.sessions = options.sessions;
  }

  /** Answers 401 unless the request has a valid session, which it then exposes. */
  public authenticate(): MiddlewareHandler<AuthEnv> {
    return async (c, next) => {
      const active = this.sessions.resolve(c);
      if (!active) {
        return AuthGuard.error(c, 401, AuthGuard.UnauthorizedCode);
      }

      c.set('user', active.user);
      c.set('session', active.session);
      return next();
    };
  }

  /** Answers 403 unless the logged-in user's role has the permission. */
  public requirePermission(permission: Permission): MiddlewareHandler<AuthEnv> {
    return async (c, next) => {
      if (!hasPermission(c.get('user').role, permission)) {
        return AuthGuard.error(c, 403, AuthGuard.ForbiddenCode);
      }
      return next();
    };
  }

  protected static error(
    c: Context<AuthEnv>,
    status: 401 | 403,
    code: string,
  ): Response {
    c.header('Cache-Control', 'no-store');
    return c.json({ error: code }, status);
  }
}

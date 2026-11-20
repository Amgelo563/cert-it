import {
  ApiErrorCodeEnum,
  hasPermission,
  type Permission,
} from '@cert-it/shared';
import type { MiddlewareHandler } from 'hono';
import { apiError } from '../http/api/apiError';
import type { AuthEnv } from './AuthEnv';
import type { SessionService } from './session/SessionService';

type AuthGuardOptions = {
  sessions: SessionService;
};

/** Middleware that requires a logged-in user and checks their role. */
export class AuthGuard {
  protected readonly sessions: SessionService;

  constructor(options: AuthGuardOptions) {
    this.sessions = options.sessions;
  }

  /** Answers 401 without a valid session, and 403 while the user must change their password unless allowed. */
  public authenticate(
    options: { allowPendingPasswordChange?: boolean } = {},
  ): MiddlewareHandler<AuthEnv> {
    return async (c, next) => {
      const active = this.sessions.resolve(c);
      if (!active) {
        return apiError(c, 401, ApiErrorCodeEnum.Unauthorized);
      }
      if (
        active.user.mustChangePassword
        && !options.allowPendingPasswordChange
      ) {
        return apiError(c, 403, ApiErrorCodeEnum.PasswordChangeRequired);
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
        return apiError(c, 403, ApiErrorCodeEnum.Forbidden);
      }
      return next();
    };
  }
}

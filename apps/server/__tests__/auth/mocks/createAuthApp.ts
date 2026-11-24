import { SiteUrl } from '@cert-it/hono';
import { PermissionEnum } from '@cert-it/shared';
import { Hono } from 'hono';
import type { AuthEnv } from '../../../src/auth/AuthEnv';
import { AuthGuard } from '../../../src/auth/AuthGuard';
import { ApiService } from '../../../src/http/api/ApiService';
import { SessionService } from '../../../src/auth/session/SessionService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import type { UserId } from '../../../src/user/User';
import { SystemClock } from '../../../src/clock/SystemClock';

/** A small app with login, logout and guarded routes, for testing sessions and guards. */
export function createAuthApp(
  database: DatabaseService,
  options: { baseUrl?: string; now?: () => number } = {},
) {
  const siteUrl = new SiteUrl({
    baseUrl: options.baseUrl ?? 'https://certs.example.org',
  });
  const { now } = options;
  const sessions = new SessionService({
    database,
    siteUrl,
    clock: now ? { now: () => new Date(now()) } : SystemClock.Instance,
  });
  const guard = new AuthGuard({ sessions });
  const csrf = ApiService.createCsrfGuard(siteUrl);
  const app = new Hono<AuthEnv>();

  app.use(csrf.middleware());
  app.post('/login/:userId', (c) => {
    sessions.open(c, Number(c.req.param('userId')) as UserId);
    return c.body(null, 204);
  });
  app.post('/logout', (c) => {
    sessions.end(c);
    return c.body(null, 204);
  });
  app.get(
    '/me',
    guard.authenticate({ allowPendingPasswordChange: true }),
    (c) => c.json(c.get('user')),
  );
  app.get(
    '/audit',
    guard.authenticate(),
    guard.requirePermission(PermissionEnum.ViewAuditLog),
    (c) => c.text('audit'),
  );

  return { app, sessions };
}

/** Returns the session cookie pair from a response, ready for a Cookie header. */
export function sessionCookie(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  return header.split(';')[0]!;
}

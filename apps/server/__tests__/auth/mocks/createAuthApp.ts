import { PermissionEnum } from '@cert-it/shared';
import { Hono } from 'hono';
import type { AuthEnv } from '../../../src/auth/AuthEnv';
import { AuthGuard } from '../../../src/auth/AuthGuard';
import { CsrfGuard } from '../../../src/auth/csrf/CsrfGuard';
import { SessionService } from '../../../src/auth/session/SessionService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { SiteUrl } from '../../../src/http/url/SiteUrl';
import type { UserId } from '../../../src/user/User';

/** A small app with login, logout and guarded routes, for testing sessions and guards. */
export function createAuthApp(
  database: DatabaseService,
  options: { baseUrl?: string; now?: () => number } = {},
) {
  const siteUrl = new SiteUrl({
    baseUrl: options.baseUrl ?? 'https://certs.example.org',
  });
  const sessions = new SessionService({ database, siteUrl, now: options.now });
  const guard = new AuthGuard({ sessions });
  const csrf = new CsrfGuard({ siteUrl });
  const app = new Hono<AuthEnv>();

  app.use(csrf.middleware());
  app.post('/login/:userId', (c) => {
    sessions.create(c, Number(c.req.param('userId')) as UserId);
    return c.body(null, 204);
  });
  app.post('/logout', (c) => {
    sessions.end(c);
    return c.body(null, 204);
  });
  app.get('/me', guard.authenticate(), (c) => c.json(c.get('user')));
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

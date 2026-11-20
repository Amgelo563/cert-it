import { RateLimiter, type SiteUrl } from '@cert-it/hono';
import { AuditLogService } from '../../../src/audit/AuditLogService';
import { AuthGuard } from '../../../src/auth/AuthGuard';
import { AuthService } from '../../../src/auth/AuthService';
import { createCsrfGuard } from '../../../src/auth/csrf/createCsrfGuard';
import { PasswordHasher } from '../../../src/auth/password/PasswordHasher';
import { SessionService } from '../../../src/auth/session/SessionService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { UserService } from '../../../src/user/UserService';

/** Returns the auth, user and audit log options of HttpService, with rate limits that tests can reach. */
export function createAuthOptions(
  database: DatabaseService,
  siteUrl: SiteUrl,
  options: { maxAttempts?: number; now?: () => number } = {},
) {
  const sessions = new SessionService({ database, siteUrl, now: options.now });
  const limiter = () =>
    new RateLimiter({
      maxHits: options.maxAttempts ?? 15,
      windowMs: 60_000,
      now: options.now,
    });
  const passwords = new PasswordHasher();
  const guard = new AuthGuard({ sessions });
  const auditLog = new AuditLogService({ database, guard });
  const auth = new AuthService({
    database,
    sessions,
    passwords,
    guard,
    auditLog,
    ipLimiter: limiter(),
    accountLimiter: limiter(),
  });

  const users = new UserService({
    database,
    passwords,
    sessions,
    guard,
    auditLog,
    firstAdminEmail: 'admin@example.org',
    log: () => {},
  });

  return { auth, users, auditLog, csrf: createCsrfGuard(siteUrl) };
}

import { AuthGuard } from '../../../src/auth/AuthGuard';
import { AuthService } from '../../../src/auth/AuthService';
import { CsrfGuard } from '../../../src/auth/csrf/CsrfGuard';
import { PasswordHasher } from '../../../src/auth/password/PasswordHasher';
import { RateLimiter } from '../../../src/auth/rateLimit/RateLimiter';
import { SessionService } from '../../../src/auth/session/SessionService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import type { SiteUrl } from '../../../src/http/url/SiteUrl';

/** Returns the auth options of HttpService, with rate limits that tests can reach. */
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
  const auth = new AuthService({
    database,
    sessions,
    passwords: new PasswordHasher(),
    guard: new AuthGuard({ sessions }),
    ipLimiter: limiter(),
    accountLimiter: limiter(),
  });

  return { auth, csrf: new CsrfGuard({ siteUrl }) };
}

import { CsrfGuard, RateLimiter, SiteUrl } from '@cert-it/hono';
import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { html } from 'hono/html';
import type { Config } from '../../config/schema/ConfigSchema';
import type { Course, CourseId } from '../../course/Course';
import type { DatabaseService } from '../../database/DatabaseService';
import type { HttpEnv } from '../../http/HttpEnv';
import type { PublicAssetsService } from '../../page/PublicAssetsService';
import { PublicLayout } from '../../page/PublicLayout';
import { normalizeEmail } from '../../util/email/NormalizedEmail';
import { CertificatePageService } from '../page/CertificatePageService';
import { LookupPage } from './LookupPage';

type LookupPageServiceOptions = {
  database: DatabaseService;
  assets: PublicAssetsService;
  siteUrl: SiteUrl;
  /** Limits searches per client IP. */
  limiter: RateLimiter;
  /** Rejects form posts from other sites. */
  csrf: CsrfGuard;
  /** Name of the issuing organization, as in site.org_name. */
  orgName: string;
};

type LookupValues = {
  email: string;
  courseId: number | null;
};

/** Serves the public "Find my certificate" page at the base path, which sends a match to its certificate's page. */
export class LookupPageService {
  /** Path of the page, relative to the base path. */
  public static readonly Path = '/';

  // entry name in apps/public/vite.config.ts
  protected static readonly AssetsEntry = 'lookup';

  // an email and a course ID, with room to spare
  protected static readonly MaxBodyBytes = 4 * 1024;

  protected readonly database: DatabaseService;

  protected readonly assets: PublicAssetsService;

  protected readonly siteUrl: SiteUrl;

  protected readonly limiter: RateLimiter;

  protected readonly csrf: CsrfGuard;

  protected readonly orgName: string;

  protected readonly app: Hono<HttpEnv>;

  constructor(options: LookupPageServiceOptions) {
    this.database = options.database;
    this.assets = options.assets;
    this.siteUrl = options.siteUrl;
    this.limiter = options.limiter;
    this.csrf = options.csrf;
    this.orgName = options.orgName;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    assets: PublicAssetsService;
    injections?: Partial<LookupPageServiceOptions>;
  }): LookupPageService {
    const { config, database, assets, injections } = options;
    const { maxRequests, windowMinutes } = config.lookup.rateLimit;
    const siteUrl =
      injections?.siteUrl ?? new SiteUrl({ baseUrl: config.site.baseUrl });

    return new LookupPageService({
      database: injections?.database ?? database,
      assets: injections?.assets ?? assets,
      siteUrl,
      limiter:
        injections?.limiter
        ?? new RateLimiter({
          maxHits: maxRequests,
          windowMs: windowMinutes * 60 * 1000,
        }),
      // from base_url only, never from Host or X-Forwarded headers
      csrf: injections?.csrf ?? new CsrfGuard({ origin: siteUrl.getOrigin() }),
      orgName: injections?.orgName ?? config.site.orgName,
    });
  }

  /** Returns the routes, to mount under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  protected createApp(): Hono<HttpEnv> {
    const app = new Hono<HttpEnv>({ strict: false });

    app.get(LookupPageService.Path, (c) => {
      // lists the courses, which admins can change at any time
      c.header('Cache-Control', 'no-cache');
      return this.render(c, { email: '', courseId: null }, null);
    });
    app.post(
      LookupPageService.Path,
      this.csrf.middleware(),
      bodyLimit({
        maxSize: LookupPageService.MaxBodyBytes,
        onError: (c) => c.text('Payload Too Large', 413),
      }),
      (c) => this.lookup(c),
    );

    return app;
  }

  // every miss answers alike: unknown email, other course, revoked, or a course not listed
  protected async lookup(c: Context<HttpEnv>): Promise<Response> {
    const values = LookupPageService.readValues(await c.req.parseBody());
    const texts = c.get('messages').get(c.get('locale')).lookupPage;
    c.header('Cache-Control', 'no-store');

    const waitSeconds = this.limiter.hit(c.get('clientIp'));
    if (waitSeconds > 0) {
      c.header('Retry-After', String(waitSeconds));
      const minutes = String(Math.ceil(waitSeconds / 60));
      return this.render(
        c,
        values,
        c.get('messages').format(texts.tooManyRequests, { minutes }),
        429,
      );
    }

    const course = this.findCourse(values.courseId);
    const certificate =
      course
      && values.email
      && this.database
        .getRepositories()
        .certificates.findActiveByEmail(
          course.id,
          normalizeEmail(values.email),
        );

    if (certificate) {
      return c.redirect(
        this.siteUrl.path(
          CertificatePageService.Path.replace(':code', certificate.code),
        ),
        303,
      );
    }

    return this.render(
      c,
      values,
      c.get('messages').format(texts.notFound, { org: this.orgName }),
    );
  }

  protected render(
    c: Context<HttpEnv>,
    values: LookupValues,
    message: string | null,
    status: 200 | 429 = 200,
  ): Response | Promise<Response> {
    const locale = c.get('locale');
    const messages = c.get('messages');
    const texts = messages.get(locale).lookupPage;
    const courses = this.database.getRepositories().courses.listForLookup();
    const org = { org: this.orgName };

    return c.html(
      html`<!doctype html>${(
          <PublicLayout
            locale={locale}
            title={texts.title}
            description={messages.format(texts.description, org)}
            orgName={this.orgName}
            assets={this.assets.getPage(LookupPageService.AssetsEntry)}
          >
            <LookupPage
              texts={texts}
              action={this.siteUrl.path(LookupPageService.Path)}
              courses={courses.map(({ id, name }) => ({ id, name }))}
              values={values}
              message={message}
              noCourses={messages.format(texts.noCourses, org)}
              help={messages.format(texts.help, org)}
              validLabel={messages.get(locale).certificatePage.valid}
            />
          </PublicLayout>
        )}`,
      status,
    );
  }

  // only courses listed in the lookup, so hidden ones can't be probed by ID
  protected findCourse(courseId: number | null): Course | null {
    if (courseId === null) return null;

    const courses = this.database.getRepositories().courses.listForLookup();
    return courses.find((course) => course.id === courseId) ?? null;
  }

  protected static readValues(body: Record<string, unknown>): LookupValues {
    const email = typeof body['email'] === 'string' ? body['email'] : '';
    const course = typeof body['course'] === 'string' ? body['course'] : '';
    const courseId = Number(course);

    return {
      email: email.trim(),
      courseId:
        course !== '' && Number.isSafeInteger(courseId) && courseId > 0
          ? (courseId as CourseId)
          : null,
    };
  }
}

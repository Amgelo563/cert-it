import { SiteUrl } from '@cert-it/hono';
import { CertificateStatusEnum, CourseDateFormatter } from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import { html } from 'hono/html';
import type { Config } from '../../config/schema/ConfigSchema';
import type { DatabaseService } from '../../database/DatabaseService';
import type { HttpEnv } from '../../http/HttpEnv';
import { LocaleResolver } from '../../i18n/LocaleResolver';
import type { PublicAssetsService } from '../../page/PublicAssetsService';
import { PublicLayout } from '../../page/PublicLayout';
import type { CertificateCode } from '../code/CertificateCode';
import { CertificateFileService } from '../file/CertificateFileService';
import { CertificateNotFound } from './CertificateNotFound';
import { CertificatePage } from './CertificatePage';

type CertificatePageServiceOptions = {
  database: DatabaseService;
  assets: PublicAssetsService;
  siteUrl: SiteUrl;
  locales: LocaleResolver;
  /** Name of the issuing organization, as in site.org_name. */
  orgName: string;
};

/** Serves the public page of each certificate at `{base_path}/c/{code}`, for active and revoked ones. */
export class CertificatePageService {
  /** Path of a certificate's page, relative to the base path. */
  public static readonly Path = '/c/:code';

  // entry name in apps/public/vite.config.ts
  protected static readonly AssetsEntry = 'certificate';

  // revocations must show at once, so browsers check back every time (cheap with the ETag)
  protected static readonly CacheControl = 'no-cache';

  protected readonly database: DatabaseService;

  protected readonly assets: PublicAssetsService;

  protected readonly siteUrl: SiteUrl;

  protected readonly locales: LocaleResolver;

  protected readonly orgName: string;

  protected readonly app: Hono<HttpEnv>;

  constructor(options: CertificatePageServiceOptions) {
    this.database = options.database;
    this.assets = options.assets;
    this.siteUrl = options.siteUrl;
    this.locales = options.locales;
    this.orgName = options.orgName;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    assets: PublicAssetsService;
    injections?: Partial<CertificatePageServiceOptions>;
  }): CertificatePageService {
    const { config, database, assets, injections } = options;

    return new CertificatePageService({
      database: injections?.database ?? database,
      assets: injections?.assets ?? assets,
      siteUrl:
        injections?.siteUrl ?? new SiteUrl({ baseUrl: config.site.baseUrl }),
      locales:
        injections?.locales
        ?? new LocaleResolver({ defaultLocale: config.site.defaultLocale }),
      orgName: injections?.orgName ?? config.site.orgName,
    });
  }

  /** Returns the routes, to mount under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  protected createApp(): Hono<HttpEnv> {
    const app = new Hono<HttpEnv>({ strict: false });
    app.get(CertificatePageService.Path, (c) => this.renderPage(c));
    return app;
  }

  protected renderPage(c: Context<HttpEnv>): Response | Promise<Response> {
    const requested = c.req.param('code') ?? '';
    // codes are read aloud and typed by hand, so lowercase ones still lead to the page
    const code = requested.toUpperCase() as CertificateCode;
    const repositories = this.database.getRepositories();
    const certificate = repositories.certificates.findByCode(code);
    const course =
      certificate && repositories.courses.findById(certificate.courseId);
    const participant =
      certificate
      && repositories.participants.findById(certificate.participantId);

    if (!certificate || !course || !participant) return this.notFound(c);
    if (requested !== code) {
      return c.redirect(this.siteUrl.path(this.pagePath(code)), 301);
    }

    const locale = this.locales.resolve({
      ...c.get('localeSources'),
      courseLocale: course.locale,
    });
    c.set('locale', locale);
    const messages = c.get('messages');
    const texts = messages.get(locale).certificatePage;
    // dates as printed on the certificate, whatever language the page is in
    const dates = new CourseDateFormatter(course);
    const names = { name: participant.name, course: course.name };
    const pagePath = this.pagePath(code);
    const revoked =
      certificate.status === CertificateStatusEnum.Revoked
        ? {
            date: dates.format(this.toDateString(certificate.revokedAt)),
            reason: certificate.revokedReason,
          }
        : null;

    c.header('Cache-Control', CertificatePageService.CacheControl);
    return c.html(
      html`<!doctype html>${(
          <PublicLayout
            locale={locale}
            title={messages.format(texts.title, names)}
            description={messages.format(texts.description, names)}
            orgName={this.orgName}
            assets={this.assets.getPage(CertificatePageService.AssetsEntry)}
          >
            <CertificatePage
              texts={texts}
              format={(text, values) => messages.format(text, values)}
              code={code}
              holderName={participant.name}
              courseName={course.name}
              issueDate={dates.format(certificate.issueDate)}
              orgName={this.orgName}
              pageUrl={this.siteUrl.url(pagePath)}
              pdfPath={this.siteUrl.path(
                CertificateFileService.Path.replace(':code', code),
              )}
              revoked={revoked}
            />
          </PublicLayout>
        )}`,
    );
  }

  protected notFound(c: Context<HttpEnv>): Response | Promise<Response> {
    const locale = c.get('locale');
    const messages = c.get('messages');
    const texts = messages.get(locale).error;

    c.header('Cache-Control', 'no-store');
    return c.html(
      html`<!doctype html>${(
          <PublicLayout
            locale={locale}
            title={texts.certificateNotFound}
            orgName={this.orgName}
            assets={this.assets.getPage(CertificatePageService.AssetsEntry)}
          >
            <CertificateNotFound
              title={texts.certificateNotFound}
              help={messages.format(texts.certificateNotFoundHelp, {
                org: this.orgName,
              })}
            />
          </PublicLayout>
        )}`,
      404,
    );
  }

  protected pagePath(code: CertificateCode): string {
    return CertificatePageService.Path.replace(':code', code);
  }

  // revocations are stored with their time; the page shows only the day, taken in UTC
  protected toDateString(date: Date | null): string {
    return (date ?? new Date()).toISOString().slice(0, 10);
  }
}

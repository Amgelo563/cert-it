import type { SiteUrl } from '@cert-it/hono';
import { CertificateStatusEnum, CourseDateFormatter } from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import { html } from 'hono/html';
import type { Config } from '../../config/schema/ConfigSchema';
import { OpenBadgeBuilder } from '../../credential/OpenBadgeBuilder';
import type { DatabaseService } from '../../database/DatabaseService';
import type { HttpEnv } from '../../http/HttpEnv';
import { LocaleResolver } from '../../i18n/LocaleResolver';
import type { PublicAssetsService } from '../../page/PublicAssetsService';
import type { LinkPreviewService } from '../../page/preview/LinkPreviewService';
import { PublicLayout } from '../../page/PublicLayout';
import type { CertificateCode } from '../code/CertificateCode';
import { CertificateFileRoutes } from '../file/CertificateFileRoutes';
import { CertificateNotFound } from './CertificateNotFound';
import { CertificatePage } from './CertificatePage';
import { LinkedInProfileLink } from './LinkedInProfileLink';

type CertificatePageRoutesOptions = {
  database: DatabaseService;
  assets: PublicAssetsService;
  previews: LinkPreviewService;
  siteUrl: SiteUrl;
  locales: LocaleResolver;
  /** Name of the issuing organization, as in site.org_name. */
  orgName: string;
  /** Null without site.linkedin_org_id, which hides the button. */
  linkedIn: LinkedInProfileLink | null;
};

/** Serves the public page of each certificate at `{base_path}/c/{code}`, for active and revoked ones. */
export class CertificatePageRoutes {
  /** Path of a certificate's page, relative to the base path. */
  public static readonly Path = '/c/:code';

  // entry name in apps/public/vite.config.ts
  protected static readonly AssetsEntry = 'certificate';

  // revocations must show at once, so browsers check back every time (cheap with the ETag)
  protected static readonly CacheControl = 'no-cache';

  protected readonly database: DatabaseService;

  protected readonly assets: PublicAssetsService;

  protected readonly previews: LinkPreviewService;

  protected readonly siteUrl: SiteUrl;

  protected readonly locales: LocaleResolver;

  protected readonly orgName: string;

  protected readonly linkedIn: LinkedInProfileLink | null;

  protected readonly app: Hono<HttpEnv>;

  constructor(options: CertificatePageRoutesOptions) {
    this.database = options.database;
    this.assets = options.assets;
    this.previews = options.previews;
    this.siteUrl = options.siteUrl;
    this.locales = options.locales;
    this.orgName = options.orgName;
    this.linkedIn = options.linkedIn;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'site'>;
    siteUrl: SiteUrl;
    database: DatabaseService;
    assets: PublicAssetsService;
    previews: LinkPreviewService;
    injections?: Partial<
      Omit<CertificatePageRoutesOptions, 'database' | 'assets' | 'previews'>
    >;
  }): CertificatePageRoutes {
    const { config, siteUrl, database, assets, previews, injections } = options;

    return new CertificatePageRoutes({
      database,
      assets,
      previews,
      siteUrl,
      locales:
        injections?.locales
        ?? new LocaleResolver({ defaultLocale: config.site.defaultLocale }),
      orgName: injections?.orgName ?? config.site.orgName,
      // an injected null turns the button off, so only undefined falls back to the config
      linkedIn:
        injections?.linkedIn !== undefined
          ? injections.linkedIn
          : config.site.linkedinOrgId
            ? new LinkedInProfileLink({
                organizationId: config.site.linkedinOrgId,
              })
            : null,
    });
  }

  /** Returns the routes, to mount under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  protected createApp(): Hono<HttpEnv> {
    const app = new Hono<HttpEnv>({ strict: false });
    app.get(CertificatePageRoutes.Path, (c) => this.renderPage(c));
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
    const issueDate = dates.format(certificate.issueDate);
    const pageUrl = this.siteUrl.url(pagePath);
    const linkedInUrl =
      this.linkedIn?.build({
        name: course.name,
        issueDate: certificate.issueDate,
        code,
        url: pageUrl,
      }) ?? null;
    const title = messages.format(texts.title, names);
    const description = messages.format(texts.description, names);
    const preview = this.previews.getCertificatePreview({
      path: pagePath,
      title,
      description,
      values: {
        ...names,
        org: this.orgName,
        date: issueDate,
        code,
        status: revoked ? texts.revokedStatus : texts.validStatus,
      },
    });

    c.header('Cache-Control', CertificatePageRoutes.CacheControl);
    return c.html(
      html`<!doctype html>${(
          <PublicLayout
            locale={locale}
            messages={messages}
            title={title}
            description={description}
            orgName={this.orgName}
            assets={this.assets.getPage(CertificatePageRoutes.AssetsEntry)}
            preview={preview}
          >
            <CertificatePage
              texts={texts}
              format={(text, values) => messages.format(text, values)}
              code={code}
              holderName={participant.name}
              courseName={course.name}
              issueDate={issueDate}
              orgName={this.orgName}
              pageUrl={pageUrl}
              linkedInUrl={linkedInUrl}
              pdfPath={this.siteUrl.path(
                CertificateFileRoutes.Path.replace(':code', code),
              )}
              credentialPath={this.siteUrl.path(
                OpenBadgeBuilder.CredentialPath.replace(':code', code),
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
            messages={messages}
            title={texts.certificateNotFound}
            orgName={this.orgName}
            assets={this.assets.getPage(CertificatePageRoutes.AssetsEntry)}
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
    return CertificatePageRoutes.Path.replace(':code', code);
  }

  // revocations are stored with their time; the page shows only the day, taken in UTC
  protected toDateString(date: Date | null): string {
    return (date ?? new Date()).toISOString().slice(0, 10);
  }
}

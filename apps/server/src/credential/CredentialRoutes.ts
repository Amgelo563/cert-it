import { createHash } from 'node:crypto';
import { CertificateStatusEnum } from '@cert-it/shared';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { etag } from 'hono/etag';
import type { CertificateCode } from '../certificate/code/CertificateCode';
import type { CourseId } from '../course/Course';
import type { DatabaseService } from '../database/DatabaseService';
import { attachmentDisposition } from '../http/util/attachmentDisposition';
import type { HttpEnv } from '../http/HttpEnv';
import type { CredentialSigner } from './CredentialSigner';
import { OpenBadgeBuilder } from './OpenBadgeBuilder';

type CredentialRoutesOptions = {
  database: DatabaseService;
  signer: CredentialSigner;
  builder: OpenBadgeBuilder;
};

type SignedStatusList = {
  version: number;
  thumbprint: string;
  jwt: string;
  etag: string;
};

/** Serves what verifiers of the Open Badges credentials fetch: each certificate's signed credential, the issuer's profile and public key, achievements and the revocation list. */
export class CredentialRoutes {
  protected static readonly JwtType = 'application/jwt';

  // status changes must reach verifiers at once, so they check back every time (cheap with the ETag)
  protected static readonly CacheControl = 'no-cache';

  protected readonly database: DatabaseService;

  protected readonly signer: CredentialSigner;

  protected readonly builder: OpenBadgeBuilder;

  protected readonly app: Hono<HttpEnv>;

  // reused until a certificate changes status or the key rotates
  protected statusList: SignedStatusList | null = null;

  constructor(options: CredentialRoutesOptions) {
    this.database = options.database;
    this.signer = options.signer;
    this.builder = options.builder;
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    signer: CredentialSigner;
    injections?: Partial<Pick<CredentialRoutesOptions, 'builder'>>;
  }): CredentialRoutes {
    const { database, signer, injections } = options;

    return new CredentialRoutes({
      database,
      signer,
      builder: injections?.builder ?? signer.getBuilder(),
    });
  }

  /** Returns the routes, to mount under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  protected createApp(): Hono<HttpEnv> {
    const app = new Hono<HttpEnv>({ strict: false });
    const routes = [
      [OpenBadgeBuilder.CredentialPath, (c) => this.serveCredential(c)],
      [OpenBadgeBuilder.IssuerPath, (c) => this.serveProfile(c)],
      [OpenBadgeBuilder.KeyPath, (c) => this.serveKey(c)],
      [OpenBadgeBuilder.AchievementPath, (c) => this.serveAchievement(c)],
      [OpenBadgeBuilder.StatusListPath, (c) => this.serveStatusList(c)],
    ] as const satisfies [string, (c: Context<HttpEnv>) => Response][];

    for (const [path, handler] of routes) {
      app.get(path, this.allowAnyOrigin(), etag(), handler);
    }
    return app;
  }

  // a revoked or unknown code answers the same 404, as the PDF does
  protected serveCredential(c: Context<HttpEnv>): Response {
    const code = c.req.param('code') as CertificateCode;
    const repositories = this.database.getRepositories();
    const certificate = repositories.certificates.findByCode(code);
    const course =
      certificate && repositories.courses.findById(certificate.courseId);
    const participant =
      certificate
      && repositories.participants.findById(certificate.participantId);
    if (
      certificate?.status !== CertificateStatusEnum.Active
      || !course
      || !participant
    ) {
      return this.notFound(c);
    }

    const jwt = this.signer.signCertificate({
      certificate,
      course,
      participant,
    });
    c.header('Cache-Control', CredentialRoutes.CacheControl);
    return c.body(jwt, 200, {
      'Content-Type': CredentialRoutes.JwtType,
      'Content-Disposition': attachmentDisposition(`${certificate.code}.jwt`),
    });
  }

  protected serveProfile(c: Context<HttpEnv>): Response {
    c.header('Cache-Control', CredentialRoutes.CacheControl);
    return c.json(this.builder.buildProfile());
  }

  // only the current key; a key's URL ends with its thumbprint, so a rotated key would get its own
  protected serveKey(c: Context<HttpEnv>): Response {
    if (c.req.param('kid') !== this.signer.getKeyThumbprint()) {
      return this.notFound(c);
    }

    c.header('Cache-Control', CredentialRoutes.CacheControl);
    return c.json(this.signer.getPublicJwk());
  }

  // only courses with an active certificate, so the IDs don't list every course
  protected serveAchievement(c: Context<HttpEnv>): Response {
    const id = Number(c.req.param('courseId'));
    if (!Number.isSafeInteger(id) || id <= 0) return this.notFound(c);

    const repositories = this.database.getRepositories();
    const course = repositories.courses.findById(id as CourseId);
    const counts = repositories.certificates
      .countByCourses([id as CourseId])
      .get(id as CourseId);
    if (!course || !counts?.[CertificateStatusEnum.Active]) {
      return this.notFound(c);
    }

    c.header('Cache-Control', CredentialRoutes.CacheControl);
    return c.json(this.builder.buildAchievement(course));
  }

  protected serveStatusList(c: Context<HttpEnv>): Response {
    const { jwt, etag } = this.getStatusList();

    c.header('Cache-Control', CredentialRoutes.CacheControl);
    return c.body(jwt, 200, {
      'Content-Type': CredentialRoutes.JwtType,
      ETag: etag,
    });
  }

  protected getStatusList(): SignedStatusList {
    const { certificates } = this.database.getRepositories();
    const version = certificates.findStatusVersion();
    const thumbprint = this.signer.getKeyThumbprint();
    if (
      this.statusList?.version === version
      && this.statusList.thumbprint === thumbprint
    ) {
      return this.statusList;
    }

    // read after the version, so a change in between only causes one more rebuild
    const jwt = this.signer.signStatusList({
      revokedIndexes: certificates.listRevokedStatusIndexes(),
      length: certificates.findStatusListLength(),
    });
    const hash = createHash('sha256').update(jwt).digest('base64url');
    this.statusList = { version, thumbprint, jwt, etag: `"${hash}"` };
    return this.statusList;
  }

  // verifiers often run in a browser on another site
  protected allowAnyOrigin(): MiddlewareHandler<HttpEnv> {
    return async (c, next) => {
      await next();
      c.header('Access-Control-Allow-Origin', '*');
    };
  }

  protected notFound(c: Context<HttpEnv>): Response {
    c.header('Cache-Control', 'no-store');
    return c.text('Not Found', 404);
  }
}

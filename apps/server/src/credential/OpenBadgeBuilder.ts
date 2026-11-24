import type { SiteUrl } from '@cert-it/hono';
import type { Certificate } from '../certificate/Certificate';
import type { Course } from '../course/Course';
import { MessageCatalog } from '../i18n/MessageCatalog';
import type { Participant } from '../participant/Participant';

type OpenBadgeBuilderOptions = {
  siteUrl: SiteUrl;
  /** Name of the issuing organization, as in site.org_name. */
  orgName: string;
  messages: MessageCatalog;
};

/** A JSON object of a credential document. */
export type CredentialDocument = Readonly<Record<string, unknown>>;

/** What a certificate's credential is built from. */
export type CredentialSource = {
  readonly certificate: Pick<Certificate, 'statusIndex' | 'code' | 'issueDate'>;
  readonly course: Course;
  readonly participant: Pick<Participant, 'name'>;
};

/** Builds the Open Badges 3.0 documents of the issuer, its achievements and its certificates, and the URLs they're served at. */
export class OpenBadgeBuilder {
  /** Path of the issuer's profile, relative to the base path. */
  public static readonly IssuerPath = '/issuer';

  /** Path of a public key in JWK form, relative to the base path. */
  public static readonly KeyPath = '/issuer/keys/:kid';

  /** Path of the revocation status list, relative to the base path. */
  public static readonly StatusListPath = '/credentials/status/revocation';

  /** Path of a course's achievement, relative to the base path. */
  public static readonly AchievementPath = '/achievements/:courseId';

  /** Path of a certificate's signed credential, relative to the base path. */
  public static readonly CredentialPath = '/c/:code/credential';

  /** Path of a certificate's public page, which identifies its credential. */
  protected static readonly PagePath = '/c/:code';

  protected static readonly CredentialContexts = [
    'https://www.w3.org/ns/credentials/v2',
    'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
  ];

  protected static readonly CredentialSchema = {
    id: 'https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json',
    type: '1EdTechJsonSchemaValidator2019',
  };

  protected static readonly StatusPurpose = 'revocation';

  protected readonly siteUrl: SiteUrl;

  protected readonly orgName: string;

  protected readonly messages: MessageCatalog;

  constructor(options: OpenBadgeBuilderOptions) {
    this.siteUrl = options.siteUrl;
    this.orgName = options.orgName;
    this.messages = options.messages;
  }

  public static create(options: {
    siteUrl: SiteUrl;
    orgName: string;
    injections?: Partial<Pick<OpenBadgeBuilderOptions, 'messages'>>;
  }): OpenBadgeBuilder {
    const { injections, ...shared } = options;

    return new OpenBadgeBuilder({
      ...shared,
      messages: injections?.messages ?? new MessageCatalog(),
    });
  }

  /** Returns the issuer's profile, as served on its own. */
  public buildProfile(): CredentialDocument {
    return {
      '@context': OpenBadgeBuilder.CredentialContexts,
      ...this.issuer(),
    };
  }

  /** Returns a course's achievement, as served on its own. */
  public buildAchievement(course: Course): CredentialDocument {
    return {
      '@context': OpenBadgeBuilder.CredentialContexts,
      ...this.achievement(course),
    };
  }

  /** Returns a certificate's OpenBadgeCredential, without a proof. Its status list index is the certificate's own, which is never reused. */
  public buildCredential(source: CredentialSource): CredentialDocument {
    const { certificate, course, participant } = source;
    const statusListUrl = this.getStatusListUrl();

    return {
      '@context': OpenBadgeBuilder.CredentialContexts,
      id: this.getCredentialId(certificate.code),
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      name: course.name,
      issuer: this.issuer(),
      validFrom: `${certificate.issueDate}T00:00:00Z`,
      credentialSubject: {
        type: ['AchievementSubject'],
        // the name is public on the certificate's page already
        identifier: [
          {
            type: 'IdentityObject',
            identityType: 'name',
            hashed: false,
            identityHash: participant.name,
          },
        ],
        achievement: this.achievement(course),
      },
      credentialStatus: {
        id: `${statusListUrl}#${certificate.statusIndex}`,
        type: 'BitstringStatusListEntry',
        statusPurpose: OpenBadgeBuilder.StatusPurpose,
        statusListIndex: String(certificate.statusIndex),
        statusListCredential: statusListUrl,
      },
      credentialSchema: [OpenBadgeBuilder.CredentialSchema],
    };
  }

  /** Returns the revocation status list credential, without a proof, given its encoded bitstring. */
  public buildStatusList(encodedList: string): CredentialDocument {
    const url = this.getStatusListUrl();

    return {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      id: url,
      type: ['VerifiableCredential', 'BitstringStatusListCredential'],
      issuer: this.getIssuerUrl(),
      credentialSubject: {
        id: `${url}#list`,
        type: 'BitstringStatusList',
        statusPurpose: OpenBadgeBuilder.StatusPurpose,
        encodedList,
      },
    };
  }

  /** Returns the URL of the issuer's profile, which is the issuer's ID. */
  public getIssuerUrl(): string {
    return this.siteUrl.url(OpenBadgeBuilder.IssuerPath);
  }

  /** Returns the URL of a public key, given its thumbprint. */
  public getKeyUrl(thumbprint: string): string {
    return this.siteUrl.url(
      OpenBadgeBuilder.KeyPath.replace(':kid', thumbprint),
    );
  }

  public getStatusListUrl(): string {
    return this.siteUrl.url(OpenBadgeBuilder.StatusListPath);
  }

  /** Returns the ID of a certificate's credential: the URL of its public page. */
  public getCredentialId(code: string): string {
    return this.siteUrl.url(
      OpenBadgeBuilder.PagePath.replace(':code', encodeURIComponent(code)),
    );
  }

  protected issuer(): CredentialDocument {
    return {
      id: this.getIssuerUrl(),
      type: ['Profile'],
      name: this.orgName,
      url: this.siteUrl.url('/'),
    };
  }

  protected achievement(course: Course): CredentialDocument {
    const texts = this.messages.get(course.locale).credential;
    const values = { course: course.name, org: this.orgName };

    return {
      id: this.siteUrl.url(
        OpenBadgeBuilder.AchievementPath.replace(
          ':courseId',
          String(course.id),
        ),
      ),
      type: ['Achievement'],
      name: course.name,
      description: this.messages.format(texts.achievementDescription, values),
      criteria: { narrative: this.messages.format(texts.criteria, values) },
      inLanguage: course.locale,
    };
  }
}

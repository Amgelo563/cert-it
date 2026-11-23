type LinkedInProfileLinkOptions = {
  /** Numeric ID of the issuer's LinkedIn page, as in site.linkedin_org_id. */
  organizationId: string;
};

/** A certification as LinkedIn's form asks for it. */
export type LinkedInCertification = {
  /** Shown as the certification's name. */
  name: string;
  /** `YYYY-MM-DD`; LinkedIn keeps only the month and year. */
  issueDate: string;
  /** Credential ID. */
  code: string;
  /** Credential URL, the certificate's public page. */
  url: string;
};

/** Builds LinkedIn "Add to Profile" links that open the certification form already filled in. */
export class LinkedInProfileLink {
  // all of LinkedIn's parameters live here, so a change on their side is a change in this class only
  protected static readonly BaseUrl = 'https://www.linkedin.com/profile/add';

  protected static readonly StartTask = 'CERTIFICATION_NAME';

  protected readonly organizationId: string;

  constructor(options: LinkedInProfileLinkOptions) {
    this.organizationId = options.organizationId;
  }

  /** Returns the link for a certification. */
  public build(certification: LinkedInCertification): string {
    const [year, month] = certification.issueDate.split('-');
    const params = new URLSearchParams({
      startTask: LinkedInProfileLink.StartTask,
      name: certification.name,
      organizationId: this.organizationId,
      issueYear: String(Number(year)),
      // months go from 1 to 12
      issueMonth: String(Number(month)),
      certUrl: certification.url,
      certId: certification.code,
    });

    // spaces as %20, the form tested on LinkedIn; a literal + is already %2B
    const query = params.toString().replaceAll('+', '%20');
    return `${LinkedInProfileLink.BaseUrl}?${query}`;
  }
}

/** Texts of the server-rendered pages and certificates, in one language. Placeholders are written as `{key}`. */
export type Messages = {
  language: {
    /** Name of the language, in itself, for the language switcher. */
    name: string;
    /** Accessible label of the language switcher. */
    switcherLabel: string;
  };
  certificate: {
    status: {
      valid: string;
      revoked: string;
    };
    /** Placeholders: {org}. */
    issuedBy: string;
  };
  /** The public page of a certificate. */
  certificatePage: {
    /** Placeholders: {name}, {course}. */
    title: string;
    /** Placeholders: {name}, {course}. */
    description: string;
    valid: string;
    revoked: string;
    /** The {status} placeholder of the configured link preview texts. */
    validStatus: string;
    /** The {status} placeholder of the configured link preview texts. */
    revokedStatus: string;
    course: string;
    issueDate: string;
    issuer: string;
    code: string;
    download: string;
    copyLink: string;
    linkCopied: string;
    addToLinkedIn: string;
    /** Shown with the link when the browser won't let the page copy it. */
    copyLinkManually: string;
    /** Shown in place of the preview without JavaScript or when drawing fails. */
    previewUnavailable: string;
    /** Link under {@link previewUnavailable}, opening the PDF in the browser's viewer. */
    viewPdf: string;
    loadingPreview: string;
    /** Accessible label of the preview. Placeholders: {name}, {course}. */
    previewLabel: string;
    /** Placeholders: {date}. */
    revokedOn: string;
    /** Placeholders: {reason}. */
    revokedReason: string;
    /** Placeholders: {org}. */
    revokedHelp: string;
  };
  /** The public "Find my certificate" page. */
  lookupPage: {
    title: string;
    /** Placeholders: {org}. */
    description: string;
    intro: string;
    email: string;
    course: string;
    /** Empty first option of the course select. */
    chooseCourse: string;
    submit: string;
    /** Under the form: where a match leads. */
    nextStep: string;
    /** Footer line. Placeholders: {org}. */
    help: string;
    /** Same text whatever didn't match, so it never tells whether the email is known. Placeholders: {org}. */
    notFound: string;
    /** Placeholders: {minutes}. */
    tooManyRequests: string;
    /** Shown in place of the form when no course is listed. Placeholders: {org}. */
    noCourses: string;
  };
  error: {
    notFound: string;
    certificateNotFound: string;
    /** Placeholders: {org}. */
    certificateNotFoundHelp: string;
  };
};

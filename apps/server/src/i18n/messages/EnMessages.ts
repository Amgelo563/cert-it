import type { Messages } from './Messages';

export const EnMessages = {
  language: {
    name: 'English',
    switcherLabel: 'Language',
  },
  certificate: {
    status: {
      valid: 'Valid',
      revoked: 'Revoked',
    },
    issuedBy: 'Issued by {org}',
  },
  certificatePage: {
    title: '{name}, {course}',
    description: 'Certificate issued to {name} for {course}.',
    valid: 'Valid certificate',
    revoked: 'Revoked certificate',
    validStatus: 'Valid',
    revokedStatus: 'Revoked',
    course: 'Course',
    issueDate: 'Issue date',
    issuer: 'Issued by',
    code: 'Certificate code',
    download: 'Download',
    downloadOptions: 'More download options',
    downloadPdf: 'PDF',
    downloadPdfHint: 'To print or share',
    downloadCredential: 'Verifiable credential',
    downloadCredentialHint: 'For digital wallets (Open Badges 3.0)',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    addToLinkedIn: 'Add to LinkedIn',
    opensInNewTab: '(opens in a new tab)',
    copyLinkManually: 'Copy this link:',
    previewUnavailable: "We can't show the certificate preview here.",
    viewPdf: 'Open the PDF',
    loadingPreview: 'Loading preview…',
    previewLabel: 'Certificate for {name}, {course}',
    revokedOn: 'This certificate was revoked on {date}.',
    revokedReason: 'Reason: {reason}',
    revokedHelp: 'If you think this is a mistake, contact {org}.',
  },
  credential: {
    achievementDescription: 'Certificate for {course}, issued by {org}.',
    criteria: 'Awarded by {org} to participants of {course}.',
  },
  lookupPage: {
    title: 'Find my certificate',
    description: 'Find your certificate from {org} with your email and course.',
    intro: 'Enter the email you used to sign up, then choose your course.',
    email: 'Email',
    course: 'Course',
    chooseCourse: 'Choose a course',
    submit: 'Find certificate',
    nextStep:
      "If we find it, you'll go to your certificate's page, where you can download the PDF or share the link.",
    help: "Can't find it? Contact {org}.",
    notFound:
      "We couldn't find a certificate for that email and course. Make sure it's the email you signed up with, or contact {org}.",
    tooManyRequests:
      'Too many searches in a short time. Try again in {minutes} min.',
    noCourses:
      "Certificate search isn't available for any course right now. If you need your certificate, contact {org}.",
  },
  error: {
    notFound: 'Page not found',
    certificateNotFound: 'Certificate not found',
    certificateNotFoundHelp:
      'No certificate matches this link. Make sure you copied the whole link, or contact {org}.',
  },
} satisfies Messages;

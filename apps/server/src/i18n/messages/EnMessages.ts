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
    description: 'Certificate of {name} for {course}.',
    valid: 'Valid certificate',
    revoked: 'Revoked certificate',
    course: 'Course',
    issueDate: 'Issue date',
    issuer: 'Issued by',
    code: 'Certificate code',
    download: 'Download PDF',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    copyLinkManually: 'Copy this link:',
    previewUnavailable: "The preview can't be shown here.",
    viewPdf: 'Open the PDF',
    loadingPreview: 'Loading preview…',
    previewLabel: 'Certificate for {name}, {course}',
    revokedOn: 'This certificate was revoked on {date}.',
    revokedReason: 'Reason: {reason}',
    revokedHelp: 'If you think this is a mistake, contact {org}.',
  },
  error: {
    notFound: 'Page not found',
    certificateNotFound: 'Certificate not found',
    certificateNotFoundHelp:
      'There is no certificate with this code. Check the link, or contact {org}.',
  },
} satisfies Messages;

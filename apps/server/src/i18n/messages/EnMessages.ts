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
    validStatus: 'Valid',
    revokedStatus: 'Revoked',
    course: 'Course',
    issueDate: 'Issue date',
    issuer: 'Issued by',
    code: 'Certificate code',
    download: 'Download',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    addToLinkedIn: 'Add to LinkedIn',
    opensInNewTab: '(opens in a new tab)',
    copyLinkManually: 'Copy this link:',
    previewUnavailable: "The preview can't be shown here.",
    viewPdf: 'Open the PDF',
    loadingPreview: 'Loading preview…',
    previewLabel: 'Certificate for {name}, {course}',
    revokedOn: 'This certificate was revoked on {date}.',
    revokedReason: 'Reason: {reason}',
    revokedHelp: 'If you think this is a mistake, contact {org}.',
  },
  lookupPage: {
    title: 'Find my certificate',
    description: 'Find your certificate from {org} with your email and course.',
    intro:
      'Enter the email you registered with and choose your course to open your certificate.',
    email: 'Email',
    course: 'Course',
    chooseCourse: 'Choose a course',
    submit: 'Find certificate',
    nextStep:
      "You'll go to your certificate's page, where you can download the PDF or share its link.",
    help: "Can't find it? Contact {org}.",
    notFound:
      "We couldn't find a certificate with those details. Check the email you registered with, or contact {org}.",
    tooManyRequests:
      'Too many searches from your connection. Try again in {minutes} min.',
    noCourses:
      'No courses can be searched right now. If you need your certificate, contact {org}.',
  },
  error: {
    notFound: 'Page not found',
    certificateNotFound: 'Certificate not found',
    certificateNotFoundHelp:
      'There is no certificate with this code. Check the link, or contact {org}.',
  },
} satisfies Messages;

import type { AppMessages } from './AppMessages';

export const EnAppMessages = {
  app: {
    title: 'cert-it admin',
    name: 'cert-it',
    loading: 'Loading…',
  },
  language: {
    name: 'English',
    switcherLabel: 'Language',
  },
  layout: {
    toggleNavigation: 'Show or hide the menu',
    navigationLabel: 'Main navigation',
    toggleColorScheme: 'Switch between light and dark mode',
  },
  navigation: {
    overview: 'Overview',
    courses: 'Courses',
    administration: 'Administration',
    users: 'Users',
    auditLog: 'Audit log',
  },
  table: {
    range: '{from}–{to} of {total}',
    firstPage: 'First page',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    lastPage: 'Last page',
  },
  leaveGuard: {
    title: 'Leave without saving?',
    text: 'Your changes on this page will be lost.',
    leave: 'Leave',
    stay: 'Stay',
  },
  errors: {
    notFoundTitle: 'Page not found',
    notFoundDescription: "The page you're looking for doesn't exist",
    forbiddenTitle: "You can't open this page",
    forbiddenDescription:
      "Your role doesn't include this page. If you need it, ask an administrator.",
    unexpectedTitle: 'Something went wrong',
    unexpectedDescription:
      "This page couldn't load. Reload it, and if that doesn't help, tell an administrator.",
    backHome: 'Back to home',
    reload: 'Reload',
  },
  apiErrors: {
    codes: {
      invalidRequest:
        "Some values in the form aren't valid. Check them and try again.",
      unauthorized: 'Your session has ended. Log in again.',
      forbidden: "Your role doesn't allow this.",
      crossOrigin:
        'This action was blocked for security reasons. Reload the page and try again.',
      passwordChangeRequired: 'Change your password to continue.',
      invalidCredentials:
        'The email or password is wrong, or the account is deactivated.',
      tooManyAttempts: 'Too many attempts. Try again later.',
      wrongPassword: 'The current password is wrong.',
      samePassword: 'The new password must be different from the current one.',
      notFound: 'This was deleted or no longer exists. Reload the page.',
      emailTaken: 'Another user already has this email.',
      participantEmailTaken:
        'Another participant of this course already has this email.',
      lastAdmin: 'There must be at least one active admin.',
      ownAccount: "You can't change your own role, status or password here.",
      fileTooLarge: 'The file is too large.',
      invalidFont: "This file isn't a font, or it's damaged.",
      fontCollection:
        'The file holds several fonts. Upload a single TTF or OTF font.',
      webFont:
        'This is a web font (WOFF or WOFF2). Upload the TTF or OTF version.',
      invalidPdf: "This file isn't a PDF, or it's damaged.",
      encryptedPdf:
        'The PDF is password-protected. Upload a version without protection.',
      pdfNotOnePage: 'The PDF must have exactly one page.',
      unknownFont:
        "A field uses a font that's no longer available. Pick another font for it, then save.",
      unknownBasePdf:
        "The base PDF you uploaded isn't on the server anymore. Upload it again, then save.",
      catalogUnavailable:
        "The font catalog isn't responding. Try again later, or upload the font file instead.",
      noTemplate: 'Save a template with a participant name field first.',
      nothingToIssue: 'Every selected participant already has a certificate.',
      certificateRevoked:
        'The certificate is already revoked. Reload the page.',
      certificateActive: 'The certificate is already active. Reload the page.',
      nothingToRegenerate:
        'Every certificate already uses the latest template.',
      jobNotFailed: 'Only a job that failed can be retried. Reload the page.',
    },
    network: "Couldn't reach the server. Check your connection and try again.",
    unexpected: 'Something went wrong. Try again.',
    tooManyAttemptsWait: 'Too many attempts. Try again in {wait}.',
  },
} satisfies AppMessages;

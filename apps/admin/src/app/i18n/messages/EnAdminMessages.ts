import type { AdminMessages } from './AdminMessages';

export const EnAdminMessages = {
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
    toggleNavigation: 'Toggle navigation',
    navigationLabel: 'Main navigation',
    toggleColorScheme: 'Toggle light and dark mode',
  },
  navigation: {
    overview: 'Overview',
    home: 'Home',
    templates: 'Templates',
    templateDesigner: 'Template designer',
  },
  home: {
    title: 'Home',
    description:
      'Courses, participants and certificates will be managed from here.',
    designerCardTitle: 'Template designer',
    designerCardDescription:
      'Place the participant name, date and QR code on a certificate template.',
    designerCardAction: 'Open the designer',
  },
  templateDesigner: {
    title: 'Template designer',
    description:
      'Place the participant name, date and QR code on the certificate.',
  },
  errors: {
    notFoundTitle: 'Page not found',
    notFoundDescription: "The page you're looking for doesn't exist.",
    unexpectedTitle: 'Something went wrong',
    unexpectedDescription:
      "This page couldn't be loaded. Try reloading; if it keeps happening, tell an administrator.",
    backHome: 'Back to home',
    reload: 'Reload',
  },
  apiErrors: {
    codes: {
      invalidRequest: "Check the form: some values aren't valid.",
      unauthorized: 'Your session has ended. Log in again.',
      forbidden: "Your role doesn't allow this.",
      crossOrigin:
        'The request was blocked because it came from another site. Reload the page and try again.',
      passwordChangeRequired: 'Change your password to continue.',
      invalidCredentials:
        'The email or password is wrong, or the account is deactivated.',
      tooManyAttempts: 'Too many attempts. Try again later.',
      wrongPassword: 'The current password is wrong.',
      samePassword: 'The new password must be different from the current one.',
      notFound: "It doesn't exist anymore. Reload the page.",
      emailTaken: 'Another user already has this email.',
      lastAdmin: 'There must be at least one active admin.',
      ownAccount: "You can't change your own role, status or password here.",
    },
    network: "Couldn't reach the server. Check your connection and try again.",
    unexpected: 'Something went wrong. Try again.',
    tooManyAttemptsWait: 'Too many attempts. Try again in {wait}.',
  },
} satisfies AdminMessages;

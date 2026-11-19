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
} satisfies AdminMessages;

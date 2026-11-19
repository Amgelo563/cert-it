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
  error: {
    notFound: 'Page not found',
  },
} satisfies Messages;

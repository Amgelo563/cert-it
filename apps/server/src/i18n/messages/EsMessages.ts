import type { Messages } from './Messages';

export const EsMessages = {
  language: {
    name: 'Español',
    switcherLabel: 'Idioma',
  },
  certificate: {
    status: {
      valid: 'Válido',
      revoked: 'Revocado',
    },
    issuedBy: 'Emitido por {org}',
  },
  error: {
    notFound: 'Página no encontrada',
  },
} satisfies Messages;

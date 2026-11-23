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
  certificatePage: {
    title: '{name}, {course}',
    description: 'Certificado de {name} por {course}.',
    valid: 'Certificado válido',
    revoked: 'Certificado revocado',
    validStatus: 'Válido',
    revokedStatus: 'Revocado',
    course: 'Curso',
    issueDate: 'Fecha de emisión',
    issuer: 'Emitido por',
    code: 'Código del certificado',
    download: 'Descargar PDF',
    copyLink: 'Copiar enlace',
    linkCopied: 'Enlace copiado',
    copyLinkManually: 'Copia este enlace:',
    previewUnavailable: 'No se puede mostrar la vista previa aquí.',
    viewPdf: 'Abrir el PDF',
    loadingPreview: 'Cargando vista previa…',
    previewLabel: 'Certificado de {name}, {course}',
    revokedOn: 'Este certificado fue revocado el {date}.',
    revokedReason: 'Motivo: {reason}',
    revokedHelp: 'Si crees que es un error, contacta a {org}.',
  },
  lookupPage: {
    title: 'Buscar mi certificado',
    description: 'Encuentra tu certificado de {org} con tu correo y tu curso.',
    intro:
      'Ingresa el correo con el que te registraste y elige tu curso para abrir tu certificado.',
    email: 'Correo electrónico',
    course: 'Curso',
    chooseCourse: 'Elige un curso',
    submit: 'Buscar certificado',
    nextStep:
      'Irás a la página de tu certificado, donde puedes descargar el PDF o compartir su enlace.',
    help: '¿No lo encuentras? Contacta a {org}.',
    notFound:
      'No encontramos un certificado con esos datos. Revisa el correo con el que te registraste o contacta a {org}.',
    tooManyRequests:
      'Demasiadas búsquedas desde tu conexión. Inténtalo de nuevo en {minutes} min.',
    noCourses:
      'Por ahora no se puede buscar en ningún curso. Si necesitas tu certificado, contacta a {org}.',
  },
  error: {
    notFound: 'Página no encontrada',
    certificateNotFound: 'Certificado no encontrado',
    certificateNotFoundHelp:
      'No hay ningún certificado con este código. Revisa el enlace o contacta a {org}.',
  },
} satisfies Messages;

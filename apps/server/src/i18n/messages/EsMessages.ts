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
    description: 'Certificado emitido a {name} en {course}.',
    valid: 'Certificado válido',
    revoked: 'Certificado revocado',
    validStatus: 'Válido',
    revokedStatus: 'Revocado',
    course: 'Curso',
    issueDate: 'Fecha de emisión',
    issuer: 'Emitido por',
    code: 'Código del certificado',
    download: 'Descargar',
    downloadOptions: 'Más opciones de descarga',
    downloadPdf: 'PDF',
    downloadPdfHint: 'Para imprimir o compartir',
    downloadCredential: 'Credencial verificable',
    downloadCredentialHint: 'Para billeteras digitales (Open Badges 3.0)',
    copyLink: 'Copiar enlace',
    linkCopied: 'Enlace copiado',
    addToLinkedIn: 'Añadir a LinkedIn',
    opensInNewTab: '(se abre en una pestaña nueva)',
    copyLinkManually: 'Copia este enlace:',
    previewUnavailable:
      'No podemos mostrar la vista previa del certificado aquí.',
    viewPdf: 'Abrir el PDF',
    loadingPreview: 'Cargando vista previa…',
    previewLabel: 'Certificado de {name}, {course}',
    revokedOn: 'Este certificado fue revocado el {date}.',
    revokedReason: 'Motivo: {reason}',
    revokedHelp: 'Si crees que es un error, contacta a {org}.',
  },
  credential: {
    achievementDescription: 'Certificado de {course}, emitido por {org}.',
    criteria: 'Otorgado por {org} a los participantes de {course}.',
  },
  lookupPage: {
    title: 'Buscar mi certificado',
    description: 'Encuentra tu certificado de {org} con tu correo y tu curso.',
    intro:
      'Ingresa el correo que usaste al inscribirte y luego elige tu curso.',
    email: 'Correo electrónico',
    course: 'Curso',
    chooseCourse: 'Elige un curso',
    submit: 'Buscar certificado',
    nextStep:
      'Si lo encontramos, irás a la página de tu certificado, donde puedes descargar el PDF o compartir el enlace.',
    help: '¿No lo encuentras? Contacta a {org}.',
    notFound:
      'No encontramos un certificado con ese correo y curso. Verifica que sea el correo con el que te inscribiste o contacta a {org}.',
    tooManyRequests:
      'Demasiadas búsquedas en poco tiempo. Inténtalo de nuevo en {minutes} min.',
    noCourses:
      'Por ahora la búsqueda de certificados no está disponible para ningún curso. Si necesitas tu certificado, contacta a {org}.',
  },
  error: {
    notFound: 'Página no encontrada',
    certificateNotFound: 'Certificado no encontrado',
    certificateNotFoundHelp:
      'Ningún certificado coincide con este enlace. Verifica que lo copiaste completo o contacta a {org}.',
  },
} satisfies Messages;

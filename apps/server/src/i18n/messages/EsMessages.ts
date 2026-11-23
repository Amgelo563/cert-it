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
  error: {
    notFound: 'Página no encontrada',
    certificateNotFound: 'Certificado no encontrado',
    certificateNotFoundHelp:
      'No hay ningún certificado con este código. Revisa el enlace o contacta a {org}.',
  },
} satisfies Messages;

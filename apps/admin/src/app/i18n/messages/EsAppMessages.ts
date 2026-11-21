import type { AppMessages } from './AppMessages';

export const EsAppMessages = {
  app: {
    title: 'Administración de cert-it',
    name: 'cert-it',
    loading: 'Cargando…',
  },
  language: {
    name: 'Español',
    switcherLabel: 'Idioma',
  },
  layout: {
    toggleNavigation: 'Mostrar u ocultar la navegación',
    navigationLabel: 'Navegación principal',
    toggleColorScheme: 'Cambiar entre modo claro y oscuro',
  },
  navigation: {
    overview: 'General',
    home: 'Inicio',
    courses: 'Cursos',
    administration: 'Administración',
    users: 'Usuarios',
    auditLog: 'Registro de auditoría',
  },
  table: {
    range: '{from}–{to} de {total}',
    firstPage: 'Primera página',
    previousPage: 'Página anterior',
    nextPage: 'Página siguiente',
    lastPage: 'Última página',
  },
  leaveGuard: {
    title: '¿Salir sin guardar?',
    text: 'Se perderán los cambios de esta página.',
    leave: 'Salir',
    stay: 'Quedarme',
  },
  errors: {
    notFoundTitle: 'Página no encontrada',
    notFoundDescription: 'La página que buscas no existe',
    forbiddenTitle: 'No puedes abrir esta página',
    forbiddenDescription:
      'Tu rol no incluye esta página. Si la necesitas, pídesela a un administrador.',
    unexpectedTitle: 'Algo salió mal',
    unexpectedDescription:
      'No se pudo cargar esta página. Intenta recargarla; si sigue pasando, avisa a un administrador.',
    backHome: 'Volver al inicio',
    reload: 'Recargar',
  },
  apiErrors: {
    codes: {
      invalidRequest: 'Revisa el formulario: algunos valores no son válidos.',
      unauthorized: 'Tu sesión terminó. Vuelve a iniciar sesión.',
      forbidden: 'Tu rol no permite hacer esto.',
      crossOrigin:
        'Se bloqueó la solicitud porque vino de otro sitio. Recarga la página e inténtalo de nuevo.',
      passwordChangeRequired: 'Cambia tu contraseña para continuar.',
      invalidCredentials:
        'El correo o la contraseña son incorrectos, o la cuenta está desactivada.',
      tooManyAttempts: 'Demasiados intentos. Inténtalo más tarde.',
      wrongPassword: 'La contraseña actual es incorrecta.',
      samePassword: 'La nueva contraseña debe ser distinta de la actual.',
      notFound: 'Ya no existe. Recarga la página.',
      emailTaken: 'Otro usuario ya tiene este correo.',
      participantEmailTaken:
        'Otro participante de este curso ya tiene este correo.',
      lastAdmin: 'Debe quedar al menos un administrador activo.',
      ownAccount:
        'No puedes cambiar tu propio rol, estado o contraseña desde aquí.',
      fileTooLarge: 'El archivo es demasiado grande.',
      invalidFont: 'El archivo está dañado o no es una fuente.',
      fontCollection:
        'El archivo contiene varias fuentes. Sube una sola fuente TTF u OTF.',
      webFont: 'Es una fuente web (WOFF o WOFF2). Sube la versión TTF u OTF.',
      invalidPdf: 'El archivo está dañado o no es un PDF.',
      encryptedPdf:
        'El PDF está protegido con contraseña. Sube una versión sin protección.',
      pdfNotOnePage: 'El PDF debe tener exactamente una página.',
      unknownFont: 'Un campo usa una fuente que ya no está disponible.',
      unknownBasePdf: 'Vuelve a subir el PDF base y guarda de nuevo.',
      catalogUnavailable:
        'El catálogo de fuentes no respondió. Inténtalo más tarde o sube el archivo de la fuente.',
    },
    network:
      'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    unexpected: 'Algo salió mal. Inténtalo de nuevo.',
    tooManyAttemptsWait: 'Demasiados intentos. Inténtalo de nuevo en {wait}.',
  },
} satisfies AppMessages;

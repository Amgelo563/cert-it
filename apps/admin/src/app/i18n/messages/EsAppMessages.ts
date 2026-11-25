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
    toggleNavigation: 'Mostrar u ocultar el menú',
    navigationLabel: 'Navegación principal',
    toggleColorScheme: 'Cambiar entre modo claro y oscuro',
  },
  navigation: {
    overview: 'General',
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
      'No se pudo cargar esta página. Recárgala y, si el problema sigue, avisa a un administrador.',
    backHome: 'Volver al inicio',
    reload: 'Recargar',
  },
  apiErrors: {
    codes: {
      invalidRequest:
        'Algunos valores del formulario no son válidos. Revísalos e inténtalo de nuevo.',
      unauthorized: 'Tu sesión terminó. Vuelve a iniciar sesión.',
      forbidden: 'Tu rol no permite hacer esto.',
      crossOrigin:
        'Esta acción se bloqueó por seguridad. Recarga la página e inténtalo de nuevo.',
      passwordChangeRequired: 'Cambia tu contraseña para continuar.',
      invalidCredentials:
        'El correo o la contraseña son incorrectos, o la cuenta está desactivada.',
      tooManyAttempts: 'Demasiados intentos. Inténtalo más tarde.',
      wrongPassword: 'La contraseña actual es incorrecta.',
      samePassword: 'La nueva contraseña debe ser distinta de la actual.',
      notFound: 'Esto se eliminó o ya no existe. Recarga la página.',
      emailTaken: 'Otro usuario ya tiene este correo.',
      participantEmailTaken:
        'Otro participante de este curso ya tiene este correo.',
      lastAdmin: 'Debe quedar al menos un administrador activo.',
      ownAccount:
        'No puedes cambiar tu propio rol, estado o contraseña desde aquí.',
      fileTooLarge: 'El archivo es demasiado grande.',
      invalidFont: 'Este archivo no es una fuente o está dañado.',
      fontCollection:
        'El archivo contiene varias fuentes. Sube una sola fuente TTF u OTF.',
      webFont: 'Es una fuente web (WOFF o WOFF2). Sube la versión TTF u OTF.',
      invalidPdf: 'Este archivo no es un PDF o está dañado.',
      encryptedPdf:
        'El PDF está protegido con contraseña. Sube una versión sin protección.',
      pdfNotOnePage: 'El PDF debe tener exactamente una página.',
      unknownFont:
        'Un campo usa una fuente que ya no está disponible. Elige otra fuente para él y guarda.',
      unknownBasePdf:
        'El PDF base que subiste ya no está en el servidor. Vuelve a subirlo y guarda.',
      catalogUnavailable:
        'El catálogo de fuentes no responde. Inténtalo más tarde o sube el archivo de la fuente.',
      noTemplate:
        'Primero guarda una plantilla con el nombre del participante.',
      nothingToIssue:
        'Todos los participantes seleccionados ya tienen certificado.',
      certificateRevoked: 'El certificado ya está revocado. Recarga la página.',
      certificateActive: 'El certificado ya está activo. Recarga la página.',
      nothingToRegenerate:
        'Todos los certificados ya usan la última plantilla.',
      jobNotFailed:
        'Solo se puede reintentar una tarea que falló. Recarga la página.',
      unavailableInPractice:
        'Esto no está disponible en la práctica. Sal de la práctica para hacerlo de verdad.',
    },
    network:
      'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    unexpected: 'Algo salió mal. Inténtalo de nuevo.',
    tooManyAttemptsWait: 'Demasiados intentos. Inténtalo de nuevo en {wait}.',
  },
} satisfies AppMessages;

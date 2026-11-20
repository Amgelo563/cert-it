import type { AdminMessages } from './AdminMessages';

export const EsAdminMessages = {
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
    templates: 'Plantillas',
    templateDesigner: 'Diseñador de plantillas',
  },
  home: {
    title: 'Inicio',
    description: 'Desde aquí se gestionarán los cursos, participantes y certs.',
    designerCardTitle: 'Diseñador de plantillas',
    designerCardDescription:
      'Ubica el nombre del participante, la fecha y el código QR en una plantilla de certificado.',
    designerCardAction: 'Abrir el diseñador',
  },
  templateDesigner: {
    title: 'Diseñador de plantillas',
    description:
      'Ubica el nombre del participante, la fecha y el código QR en el certificado.',
  },
  errors: {
    notFoundTitle: 'Página no encontrada',
    notFoundDescription: 'La página que buscas no existe.',
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
      lastAdmin: 'Debe quedar al menos un administrador activo.',
      ownAccount:
        'No puedes cambiar tu propio rol, estado o contraseña desde aquí.',
    },
    network:
      'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    unexpected: 'Algo salió mal. Inténtalo de nuevo.',
    tooManyAttemptsWait: 'Demasiados intentos. Inténtalo de nuevo en {wait}.',
  },
} satisfies AdminMessages;

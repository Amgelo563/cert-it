import type {AdminMessages} from './AdminMessages';

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
    description:
      'Desde aquí se gestionarán los cursos, participantes y certs.',
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
} satisfies AdminMessages;

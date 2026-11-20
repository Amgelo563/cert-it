import type { CourseMessages } from './CourseMessages';

export const EsCourseMessages = {
  courses: {
    title: 'Cursos',
    description: 'Cursos y eventos cuyos participantes reciben certificados',
    add: 'Nuevo curso',
    listTitle: 'Todos los cursos',
    count: '{count} en total',
    empty: 'Aún no hay cursos.',
    name: 'Nombre',
    locale: 'Idioma',
    localeDescription: 'Se usa en los certificados y las páginas públicas',
    dateFormat: 'Formato de fecha',
    dateFormatDescription:
      'D día, M número de mes, MMMM nombre del mes, YYYY año. El texto entre [corchetes] se mantiene tal cual.',
    datePreview: 'Hoy: {date}',
    lookupEnabled: 'Mostrar en la búsqueda pública',
    lookupDescription:
      'Los participantes pueden encontrar su certificado por correo en la página de búsqueda',
    participants: 'Participantes',
    certificates: 'Certificados',
    revokedCount: '{count} revocados',
    lookup: 'Búsqueda',
    listed: 'Visible',
    hidden: 'Oculto',
    archived: 'Archivado',
    createdAt: 'Creado',
    backToList: 'Todos los cursos',
    tabsLabel: 'Secciones del curso',
    tabs: {
      participants: 'Participantes',
      template: 'Plantilla',
      settings: 'Configuración',
    },
    listedInLookup: 'Visible en la búsqueda',
    hiddenFromLookup: 'Oculto en la búsqueda',
    revoked: 'Revocados',
    generalTitle: 'General',
    saveSubmit: 'Guardar cambios',
    discard: 'Descartar cambios',
    archiveSection: 'Archivar el curso',
    archiveSectionText:
      'Los cursos archivados dejan de aparecer en la búsqueda pública. Sus certificados siguen siendo válidos y se pueden abrir desde sus enlaces.',
    unarchiveSectionText:
      'Este curso está archivado, así que no aparece en la búsqueda pública. Desarchívalo para volver a mostrarlo.',
    deleteSection: 'Eliminar el curso',
    deleteSectionText:
      'Elimina el curso con sus participantes y certificados. Los enlaces de los certificados dejan de funcionar. No se puede deshacer.',
    archive: 'Archivar',
    archiveTitle: '¿Archivar este curso?',
    archiveText:
      '{name} dejará de aparecer en la búsqueda pública. Sus certificados siguen siendo válidos y se pueden abrir desde sus enlaces.',
    archivedNotice: '{name} se archivó.',
    unarchive: 'Desarchivar',
    unarchivedNotice: '{name} se desarchivó.',
    delete: 'Eliminar',
    deleteTitle: '¿Eliminar este curso?',
    deleteText:
      'Se eliminarán para siempre {name}, sus {participants} participantes y sus {certificates} certificados, y los enlaces de los certificados dejarán de funcionar. No se puede deshacer.',
    deleted: '{name} se eliminó.',
    addTitle: 'Nuevo curso',
    addSubmit: 'Crear curso',
    added: '{name} se creó.',
    saved: '{name} se guardó.',
    fieldRequired: 'Completa este campo.',
  },
  template: {
    emptyTitle: 'Aún no hay plantilla',
    emptyText:
      'Este curso no tiene una plantilla de certificado. Suelta aquí su PDF base o haz clic para elegirlo.',
    versionLabel: 'Versión {version}',
    unsaved: 'Sin guardar',
    replacePdf: 'Cambiar PDF base',
    pdfUploaded: 'PDF base subido. Guarda para conservarlo en la plantilla.',
    largePdf:
      'Este PDF pesa {size}. Cada certificado lleva una copia completa, así que multiplica el uso de disco y el tiempo de generación.',
    addFont: 'Agregar fuente',
    fontAdded: 'Se agregó {family} {style}',
    save: 'Guardar versión',
    saved: 'Guardado como versión {version}',
  },
} satisfies CourseMessages;

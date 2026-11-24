import type { CertificateMessages } from './CertificateMessages';

export const EsCertificateMessages = {
  certificates: {
    count: '{count} en la lista',
    searchPlaceholder: 'Buscar por nombre o correo',
    filterLabel: 'Estado del certificado',
    filters: {
      all: 'Todos',
      none: 'Sin emitir',
      active: 'Vigentes',
      revoked: 'Revocados',
    },
    empty: 'No hay participantes con este estado.',
    noMatches: 'Ningún participante coincide con la búsqueda.',
    participant: 'Participante',
    certificate: 'Certificado',
    issueDate: 'Fecha de emisión',
    notIssued: 'Sin emitir',
    active: 'Vigente',
    revoked: 'Revocado',
    revokedReason: 'Motivo: {reason}',
    templateVersion: 'Plantilla v{version}',
    olderTemplate: 'Plantilla v{version}, la última es v{latest}',
    openPdf: 'Abrir PDF',
    actions: 'Acciones de {name}',
    select: 'Seleccionar a {name}',
    selectAll: 'Seleccionar esta página',
    issueAll: 'Emitir a todos los que no tienen uno',
    issueSelected: 'Emitir a seleccionados ({count})',
    clearSelection: 'Quitar selección',
    noTemplate: 'Guarda una plantilla antes de emitir certificados.',
    noNameField:
      'La última plantilla no imprime el nombre del participante. Agrega un campo de nombre y guarda una nueva versión antes de emitir certificados.',
    openTemplate: 'Ir a la plantilla',
    issueTitle: 'Emitir certificados',
    issueAllText:
      'Participantes sin certificado: {count}. Cada uno recibirá un certificado con un código nuevo, hecho con la última plantilla.',
    issueSelectedText:
      'Participantes seleccionados: {count}. Cada uno recibirá un certificado con un código nuevo, hecho con la última plantilla.',
    issueDateLabel: 'Fecha de emisión',
    issueDateDescription:
      'Se imprime en los certificados tal como se ve aquí. Déjala vacía para usar la de hoy.',
    issueDateToday: 'Hoy: {date}',
    issueSubmit: 'Emitir',
    issueStarted: 'Emitiendo certificados en segundo plano: {count}.',
    revoke: 'Revocar',
    revokeTitle: 'Revocar certificado',
    revokeText:
      'El certificado {code} de {name} dejará de ser válido de inmediato. Su página lo mostrará como revocado y ya no se podrá descargar su PDF. Puedes restablecerlo después.',
    reasonLabel: 'Motivo',
    reasonDescription:
      'Queda en el registro de auditoría y se muestra en la página del certificado',
    reasonRequired: 'Indica un motivo',
    revokeSubmit: 'Revocar',
    revokedNotice: 'Se revocó el certificado de {name}.',
    reinstate: 'Restablecer',
    reinstateTitle: 'Restablecer certificado',
    reinstateText:
      'El certificado {code} de {name} vuelve a ser válido, con el mismo código y PDF.',
    reinstatedNotice: 'Se restableció el certificado de {name}.',
    edit: 'Editar',
    editTitle: 'Editar certificado',
    editText:
      'El PDF se vuelve a hacer con los nuevos datos, con el mismo código y la misma versión de plantilla.',
    nameLabel: 'Nombre',
    nameDescription: 'Tal como debe aparecer en el certificado',
    nameRequired: 'Escribe un nombre',
    dateRequired: 'Elige una fecha',
    editSubmit: 'Guardar y generar',
    editStarted: 'Actualizando el certificado de {name}.',
    delete: 'Eliminar',
    deleteTitle: 'Eliminar certificado',
    deleteText:
      'Se eliminarán para siempre el certificado {code} de {name} y su PDF, y el código dejará de funcionar. Úsalo solo para certificados emitidos por error. Para anular un certificado válido, revócalo.',
    deletedNotice: 'Se eliminó el certificado de {name}.',
    outdatedNotice:
      'Certificados con una versión anterior de la plantilla: {count}. Regenéralos para usar la última.',
    outdatedReview: 'Revisar',
    export: 'Exportar',
    exportZip: 'PDF vigentes (ZIP)',
    exportCsv: 'Códigos y enlaces (CSV)',
  },
  regenerate: {
    title: 'Regenerar certificados',
    text: 'Certificados con una versión anterior: {count}. Al regenerarlos se rehacen con la plantilla v{version} y conservan su código y fecha.',
    fromVersion: 'v{version}',
    selectAll: 'Todos',
    select: 'Seleccionar a {name}',
    notNow: 'Ahora no',
    submit: 'Regenerar ({count})',
    started: 'Regenerando certificados en segundo plano: {count}.',
    startedElsewhere:
      'Regenerando certificados en segundo plano: {count}. Sigue el avance en la pestaña Certificados.',
  },
  certificateJob: {
    titles: {
      issue: {
        pending: 'En espera',
        running: 'Emitiendo certificados',
        completed: 'Certificados emitidos',
        failed: 'La emisión se detuvo',
      },
      regenerate: {
        pending: 'En espera',
        running: 'Regenerando certificados',
        completed: 'Certificados regenerados',
        failed: 'La regeneración se detuvo',
      },
    },
    progress: '{progress} de {total}',
    rendered: 'Listos: {count}',
    skippedTitle: 'Quedaron fuera: {count}',
    skippedText:
      'A las fuentes de la plantilla les faltan algunos caracteres de los datos de estos participantes. Agrega una fuente que los tenga e inténtalo de nuevo.',
    missingCharacters: '{field}: {characters}',
    failedText:
      'La tarea se detuvo: {error}. Los certificados ya hechos se conservan, y al reintentar se hacen los demás.',
    retry: 'Reintentar',
    dismiss: 'Cerrar',
  },
} satisfies CertificateMessages;

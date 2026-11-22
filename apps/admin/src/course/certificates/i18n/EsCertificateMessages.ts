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
    empty: 'No hay participantes en este estado.',
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
    issueAll: 'Emitir a todos los que no tienen',
    issueSelected: 'Emitir a seleccionados ({count})',
    clearSelection: 'Quitar selección',
    noTemplate: 'Guarda una plantilla antes de emitir certificados.',
    issueTitle: 'Emitir certificados',
    issueAllText:
      'Participantes sin certificado: {count}. Cada uno recibe uno con un código nuevo, generado con la última plantilla.',
    issueSelectedText:
      'Participantes seleccionados: {count}. Cada uno recibe un certificado con un código nuevo, generado con la última plantilla.',
    issueDateLabel: 'Fecha de emisión',
    issueDateDescription:
      'Se imprime en los certificados. Déjala vacía para usar la de hoy.',
    issueSubmit: 'Emitir',
    issueStarted: 'Emitiendo en segundo plano: {count}.',
    revoke: 'Revocar',
    revokeTitle: 'Revocar certificado',
    revokeText:
      'El certificado {code} de {name} deja de ser válido de inmediato: su página lo muestra como revocado y su PDF ya no se sirve. Puedes restablecerlo después.',
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
  },
  certificateJob: {
    titles: {
      pending: 'En espera',
      running: 'Emitiendo certificados',
      completed: 'Certificados emitidos',
      failed: 'La emisión se detuvo',
    },
    progress: '{progress} de {total}',
    rendered: 'Total: {count}',
    skippedTitle: 'Quedaron fuera: {count}',
    skippedText:
      'Las fuentes de la plantilla no pueden dibujar algunos caracteres de sus datos. Agrega una fuente que los tenga y vuelve a emitir.',
    missingCharacters: '{field}: {characters}',
    failedText:
      'El trabajo se detuvo: {error}. Los certificados ya generados se conservan; al reintentar se generan los demás.',
    retry: 'Reintentar',
    dismiss: 'Cerrar',
  },
} satisfies CertificateMessages;

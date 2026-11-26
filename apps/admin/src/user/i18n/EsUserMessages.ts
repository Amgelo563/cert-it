import type { UserMessages } from './UserMessages';

export const EsUserMessages = {
  users: {
    title: 'Usuarios',
    description: 'Quién puede usar el panel y qué puede hacer cada persona',
    add: 'Agregar usuario',
    listTitle: 'Cuentas',
    count: '{count} en total',
    empty: 'Aún no hay usuarios.',
    name: 'Nombre',
    email: 'Correo',
    role: 'Rol',
    status: 'Estado',
    createdAt: 'Agregado',
    you: 'Tú',
    active: 'Activo',
    inactive: 'Desactivado',
    temporaryPassword: 'Contraseña temporal',
    changeRole: 'Rol de {email}',
    actions: 'Acciones para {email}',
    roleChanged: '{email} ahora es {role}.',
    deactivate: 'Desactivar',
    deactivateTitle: '¿Desactivar este usuario?',
    deactivateText:
      'Se cerrará la sesión de {email} y no podrá iniciar sesión hasta que reactives la cuenta. Sus cambios se mantienen en el registro de auditoría.',
    deactivated: 'Se desactivó a {email}.',
    reactivate: 'Reactivar',
    reactivateTitle: '¿Reactivar este usuario?',
    reactivateText:
      '{email} podrá volver a iniciar sesión con su contraseña actual.',
    reactivated: 'Se reactivó a {email}.',
    resetPassword: 'Restablecer contraseña',
    resetPasswordTitle: '¿Restablecer la contraseña?',
    resetPasswordText:
      'Se cerrará la sesión de {email} y su contraseña se reemplazará por una temporal, que verás una sola vez. Elegirá una nueva al iniciar sesión.',
    passwordReset: 'Se restableció la contraseña de {email}.',
    addTitle: 'Agregar un usuario',
    addSubmit: 'Agregar usuario',
    added: 'Se agregó a {email}.',
    invalidEmail: 'Escribe un correo válido.',
    nameRequired: 'Escribe un nombre.',
    rename: 'Cambiar nombre',
    renameTitle: 'Cambiar el nombre',
    renameSubmit: 'Guardar',
    renamed: '{email} ahora se llama {name}.',
    passwordTitle: 'Contraseña temporal',
    passwordText:
      'Comparte esta contraseña con {email} en privado. Elegirá una propia la primera vez que inicie sesión.',
    passwordLabel: 'Contraseña',
    passwordOnce:
      'Esta contraseña no se volverá a mostrar. Si se pierde, restablécela desde las acciones del usuario.',
    copy: 'Copiar',
    copied: 'Copiada',
    notCopiedText:
      'Aún no copiaste la contraseña de {email}. Si cierras ahora, no podrás volver a verla y tendrás que restablecerla.',
    closeWithoutCopying: 'Cerrar sin copiar',
    backToPassword: 'Volver a la contraseña',
    done: 'Listo',
  },
  roles: {
    admin: 'Administrador',
    editor: 'Editor',
    viewer: 'Lector',
  },
  roleDescriptions: {
    admin:
      'Puede hacer todo, incluso gestionar usuarios y leer el registro de auditoría.',
    editor:
      'Puede editar cursos, plantillas y participantes, y emitir y revocar certificados.',
    viewer:
      'Puede ver cursos, participantes y certificados, pero no cambiarlos.',
  },
} satisfies UserMessages;

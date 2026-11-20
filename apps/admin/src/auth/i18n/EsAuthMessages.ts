import type { AuthMessages } from './AuthMessages';

export const EsAuthMessages = {
  auth: {
    loginTitle: 'Iniciar sesión',
    loginDescription: 'Usa la cuenta que te creó un administrador',
    email: 'Correo',
    password: 'Contraseña',
    login: 'Iniciar sesión',
    logout: 'Cerrar sesión',
    accountMenu: 'Cuenta',
    changePasswordTitle: 'Cambia tu contraseña',
    changePasswordRequired:
      'Tu contraseña es temporal. Elige una propia para continuar.',
    changePasswordDescription:
      'Elige una nueva contraseña de al menos {min} caracteres',
    currentPassword: 'Contraseña actual',
    newPassword: 'Nueva contraseña',
    confirmPassword: 'Repite la nueva contraseña',
    changePassword: 'Cambiar contraseña',
    passwordChanged: 'Se cambió tu contraseña.',
    cancel: 'Cancelar',
    fieldRequired: 'Completa este campo.',
    passwordTooShort: 'Usa al menos {min} caracteres.',
    passwordTooLong: 'Usa como máximo {max} caracteres.',
    passwordsDontMatch: 'Las contraseñas no coinciden.',
  },
} satisfies AuthMessages;

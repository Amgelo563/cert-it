import type { AuthMessages } from './AuthMessages';

export const EnAuthMessages = {
  auth: {
    loginTitle: 'Log in',
    loginDescription: 'Use the account an administrator created for you',
    email: 'Email',
    password: 'Password',
    showPassword: 'Show password',
    login: 'Log in',
    logout: 'Log out',
    accountMenu: 'Account',
    changePasswordTitle: 'Change your password',
    changePasswordRequired:
      'Your password is temporary. Choose one of your own to continue.',
    changePasswordDescription:
      'Choose a new password of at least {min} characters',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Repeat the new password',
    changePassword: 'Change password',
    passwordChanged: 'Your password was changed.',
    cancel: 'Cancel',
    fieldRequired: 'Fill in this field.',
    passwordTooShort: 'Use at least {min} characters.',
    passwordTooLong: 'Use at most {max} characters.',
    passwordsDontMatch: "The passwords don't match.",
  },
} satisfies AuthMessages;

/** Texts of login, logout and password changes. Placeholders are written as `{key}`. */
export type AuthMessages = {
  auth: {
    loginTitle: string;
    loginDescription: string;
    email: string;
    password: string;
    /** Label of the eye button that shows the password as it's typed. */
    showPassword: string;
    login: string;
    logout: string;
    /** Accessible label of the avatar that opens the account menu. */
    accountMenu: string;
    changePasswordTitle: string;
    /** Shown when the password is temporary and must be replaced. */
    changePasswordRequired: string;
    /** Shown when changing the password by choice, with the minimum length in `{min}`. */
    changePasswordDescription: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    changePassword: string;
    passwordChanged: string;
    cancel: string;
    fieldRequired: string;
    /** With the minimum length in `{min}`. */
    passwordTooShort: string;
    /** With the maximum length in `{max}`. */
    passwordTooLong: string;
    passwordsDontMatch: string;
  };
};

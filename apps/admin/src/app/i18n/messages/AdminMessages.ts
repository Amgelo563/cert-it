import type { ApiErrorCodeEnum, Role } from '@cert-it/shared';

/** Texts of the admin panel, in one language. Placeholders are written as `{key}`. */
export type AdminMessages = {
  app: {
    /** Title of the browser tab. */
    title: string;
    /** Short name shown next to the logo. */
    name: string;
    loading: string;
  };
  language: {
    /** Name of the language, in itself, for the language switcher. */
    name: string;
    /** Accessible label of the language switcher. */
    switcherLabel: string;
  };
  layout: {
    toggleNavigation: string;
    navigationLabel: string;
    toggleColorScheme: string;
  };
  navigation: {
    overview: string;
    home: string;
    templates: string;
    templateDesigner: string;
    administration: string;
    users: string;
    auditLog: string;
  };
  auth: {
    loginTitle: string;
    loginDescription: string;
    email: string;
    password: string;
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
  /** Names of the roles, keyed by their value. */
  roles: Record<Role, string>;
  /** What each role can do, keyed by its value. */
  roleDescriptions: Record<Role, string>;
  /** Shared by the paginated tables. */
  table: {
    /** Rows shown, with `{from}`, `{to}` and `{total}`. */
    range: string;
    firstPage: string;
    previousPage: string;
    nextPage: string;
    lastPage: string;
  };
  home: {
    title: string;
    description: string;
    designerCardTitle: string;
    designerCardDescription: string;
    designerCardAction: string;
  };
  templateDesigner: {
    title: string;
    description: string;
  };
  users: {
    title: string;
    description: string;
    add: string;
    listTitle: string;
    /** With the number of users in `{count}`. */
    count: string;
    empty: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
    /** Badge on the logged-in user's own row. */
    you: string;
    active: string;
    inactive: string;
    temporaryPassword: string;
    /** Accessible label of a row's role picker, with the user's `{email}`. */
    changeRole: string;
    /** Accessible label of a row's actions menu, with the user's `{email}`. */
    actions: string;
    roleChanged: string;
    deactivate: string;
    deactivateTitle: string;
    deactivateText: string;
    deactivated: string;
    reactivate: string;
    reactivateTitle: string;
    reactivateText: string;
    reactivated: string;
    resetPassword: string;
    resetPasswordTitle: string;
    resetPasswordText: string;
    passwordReset: string;
    addTitle: string;
    addSubmit: string;
    added: string;
    invalidEmail: string;
    passwordTitle: string;
    passwordText: string;
    passwordLabel: string;
    passwordOnce: string;
    copy: string;
    copied: string;
    done: string;
  };
  auditLog: {
    title: string;
    description: string;
  };
  errors: {
    notFoundTitle: string;
    notFoundDescription: string;
    forbiddenTitle: string;
    forbiddenDescription: string;
    unexpectedTitle: string;
    unexpectedDescription: string;
    backHome: string;
    reload: string;
  };
  /** Messages for failed API requests. */
  apiErrors: {
    /** One per error code the API answers with, keyed by its member name in ApiErrorCodeEnum, such as invalidRequest. */
    codes: Record<Uncapitalize<keyof typeof ApiErrorCodeEnum>, string>;
    /** No response arrived, such as when offline. */
    network: string;
    /** An error without a known code. */
    unexpected: string;
    /** Too many attempts, with the time to wait in `{wait}`, such as "5 minutes". */
    tooManyAttemptsWait: string;
  };
};

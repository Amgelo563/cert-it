import type { Role } from '@cert-it/shared';

/** Texts of user management and the roles. Placeholders are written as `{key}`. */
export type UserMessages = {
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
  /** Names of the roles, keyed by their value. */
  roles: Record<Role, string>;
  /** What each role can do, keyed by its value. */
  roleDescriptions: Record<Role, string>;
};

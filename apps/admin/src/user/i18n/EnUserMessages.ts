import type { UserMessages } from './UserMessages';

export const EnUserMessages = {
  users: {
    title: 'Users',
    description: 'Who can use the panel, and what each person can do',
    add: 'Add user',
    listTitle: 'Accounts',
    count: '{count} in total',
    empty: 'No users yet.',
    email: 'Email',
    role: 'Role',
    status: 'Status',
    createdAt: 'Added',
    you: 'You',
    active: 'Active',
    inactive: 'Deactivated',
    temporaryPassword: 'Temporary password',
    changeRole: 'Role of {email}',
    actions: 'Actions for {email}',
    roleChanged: '{email} is now {role}.',
    deactivate: 'Deactivate',
    deactivateTitle: 'Deactivate this user?',
    deactivateText:
      "{email} will be logged out and won't be able to log in until you reactivate the account. Their changes stay in the audit log.",
    deactivated: '{email} was deactivated.',
    reactivate: 'Reactivate',
    reactivateTitle: 'Reactivate this user?',
    reactivateText:
      '{email} will be able to log in again with their current password.',
    reactivated: '{email} was reactivated.',
    resetPassword: 'Reset password',
    resetPasswordTitle: 'Reset the password?',
    resetPasswordText:
      "{email} will be logged out and their password replaced by a temporary one, which you'll see once. They'll choose a new one when they log in.",
    passwordReset: 'The password of {email} was reset.',
    addTitle: 'Add a user',
    addSubmit: 'Add user',
    added: '{email} was added.',
    invalidEmail: 'Enter a valid email address.',
    passwordTitle: 'Temporary password',
    passwordText:
      'Give this password to {email} in a private way. They will choose their own when they first log in.',
    passwordLabel: 'Password',
    passwordOnce:
      "This password won't be shown again. If it's lost, reset it from the user's actions.",
    copy: 'Copy',
    copied: 'Copied',
    done: 'Done',
  },
  roles: {
    admin: 'Admin',
    editor: 'Editor',
    viewer: 'Viewer',
  },
  roleDescriptions: {
    admin:
      'Can do everything, including managing users and reading the audit log.',
    editor:
      'Can edit courses, templates and participants, and issue and revoke certificates.',
    viewer:
      'Can see courses, participants and certificates, but not change them.',
  },
} satisfies UserMessages;

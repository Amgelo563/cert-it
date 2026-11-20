import type {
  ApiErrorCodeEnum,
  AuditActionEnum,
  AuditEntityEnum,
  Role,
  ImportRowStatus,
  ImportSkipReasonEnum,
} from '@cert-it/shared';
import type { ColumnRole } from '../../../course/participants/import/ColumnRoleEnum';
import type { CourseTab } from '../../../course/CourseTabEnum';

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
    courses: string;
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
  courses: {
    title: string;
    description: string;
    add: string;
    listTitle: string;
    /** With the number of courses in `{count}`. */
    count: string;
    empty: string;
    name: string;
    locale: string;
    localeDescription: string;
    dateFormat: string;
    /** Help under the date format field, listing the common tokens. */
    dateFormatDescription: string;
    /** Today's date in the chosen format, in `{date}`. */
    datePreview: string;
    lookupEnabled: string;
    lookupDescription: string;
    participants: string;
    certificates: string;
    /** Revoked certificates of a row, in `{count}`. */
    revokedCount: string;
    lookup: string;
    listed: string;
    hidden: string;
    archived: string;
    createdAt: string;
    /** Link from a course's page back to the list. */
    backToList: string;
    /** Accessible label of a course's tab list. */
    tabsLabel: string;
    /** Names of a course's tabs, keyed by their path segment. */
    tabs: Record<CourseTab, string>;
    listedInLookup: string;
    hiddenFromLookup: string;
    revoked: string;
    generalTitle: string;
    saveSubmit: string;
    discard: string;
    archiveSection: string;
    archiveSectionText: string;
    unarchiveSectionText: string;
    deleteSection: string;
    deleteSectionText: string;
    archive: string;
    archiveTitle: string;
    archiveText: string;
    archivedNotice: string;
    unarchive: string;
    unarchivedNotice: string;
    delete: string;
    deleteTitle: string;
    /** With the course's `{name}` and its `{participants}` and `{certificates}` counts. */
    deleteText: string;
    deleted: string;
    addTitle: string;
    addSubmit: string;
    added: string;
    saved: string;
    fieldRequired: string;
  };
  participants: {
    /** With the number of participants in `{count}`. */
    count: string;
    /** With the number of search matches in `{count}`. */
    matches: string;
    empty: string;
    noMatches: string;
    searchPlaceholder: string;
    name: string;
    nameDescription: string;
    email: string;
    emailDescription: string;
    addedAt: string;
    certificate: string;
    notIssued: string;
    certificateActive: string;
    certificateRevoked: string;
    /** The certificate's template version, in `{version}`. */
    templateVersion: string;
    /** A certificate on an old template, with its `{version}` and the course's `{latest}`. */
    olderTemplate: string;
    openCertificate: string;
    /** Accessible label of a row's open button, with the participant's `{name}`. */
    openCertificateOf: string;
    add: string;
    addTitle: string;
    addSubmit: string;
    added: string;
    edit: string;
    editTitle: string;
    editSubmit: string;
    saved: string;
    /** Accessible label of a row's actions menu, with the participant's `{name}`. */
    actions: string;
    delete: string;
    deleteTitle: string;
    /** With the participant's `{name}` and `{email}`. */
    deleteText: string;
    deleted: string;
    fieldRequired: string;
    invalidEmail: string;
  };
  participantImport: {
    /** Button on the participants tab. */
    open: string;
    title: string;
    stepFile: string;
    stepColumns: string;
    stepPreview: string;
    dropTitle: string;
    /** With the most rows in `{max}`. */
    dropDescription: string;
    sampleText: string;
    sampleLink: string;
    emptyFile: string;
    unreadableFile: string;
    rejectedFile: string;
    /** With the file's rows in `{count}` and the most allowed in `{max}`. */
    tooManyRows: string;
    /** With the file's `{file}` name and its rows in `{count}`. */
    fileSummary: string;
    column: string;
    example: string;
    use: string;
    /** Accessible label of a column's picker, with the `{column}` header. */
    useOf: string;
    /** A column without a header, with its number in `{n}`. */
    untitled: string;
    /** What a column holds, keyed by ColumnRoleEnum value. */
    roles: Record<ColumnRole, string>;
    needNameAndEmail: string;
    /** With the most extra columns in `{max}`. */
    tooManyExtras: string;
    modeLabel: string;
    modeSkip: string;
    modeSkipDescription: string;
    modeUpdate: string;
    modeUpdateDescription: string;
    check: string;
    back: string;
    /** With the rows that would be saved in `{count}`. */
    import: string;
    filterAll: string;
    /** Filter and audit labels, keyed by ImportRowStatusEnum value. */
    groups: Record<ImportRowStatus, string>;
    /** What happens to one row, keyed by ImportRowStatusEnum value. */
    statuses: Record<ImportRowStatus, string>;
    /** Keyed by the member names in ImportSkipReasonEnum, with the current `{name}` or the earlier `{line}`. */
    reasons: Record<Uncapitalize<keyof typeof ImportSkipReasonEnum>, string>;
    errors: {
      nameRequired: string;
      nameTooLong: string;
      emailInvalid: string;
    };
    /** Under an update, with the current `{name}`. */
    previousName: string;
    line: string;
    result: string;
    noRows: string;
    /** With the `{created}`, `{updated}` and `{skipped}` counts. */
    done: string;
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
    listTitle: string;
    /** With the number of entries in `{count}`. */
    count: string;
    empty: string;
    when: string;
    who: string;
    action: string;
    target: string;
    details: string;
    /** Shown as the author of changes the app made on its own. */
    system: string;
    /** Author that no longer exists, with its `{id}`. */
    removedUser: string;
    detailRole: string;
    detailStatus: string;
    /** Keyed by the member names in AuditActionEnum, such as changePassword. */
    actions: Record<Uncapitalize<keyof typeof AuditActionEnum>, string>;
    /** Keyed by the member names in AuditEntityEnum, such as templateVersion. */
    entities: Record<Uncapitalize<keyof typeof AuditEntityEnum>, string>;
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

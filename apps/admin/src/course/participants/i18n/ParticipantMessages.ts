import type { ImportRowStatus, ImportSkipReasonEnum } from '@cert-it/shared';
import type { ColumnRole } from '../import/ColumnRoleEnum';

/** Texts of a course's participants and their import. Placeholders are written as `{key}`. */
export type ParticipantMessages = {
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
};

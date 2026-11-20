import type { CourseTab } from '../CourseTabEnum';

/** Texts of the course pages and their template tab. Placeholders are written as `{key}`. */
export type CourseMessages = {
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
  template: {
    /** Shown in place of the Designer's template when the course has none yet. */
    emptyTitle: string;
    emptyText: string;
  };
};

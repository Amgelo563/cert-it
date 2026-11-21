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
    /** Number of the version on the canvas, in `{version}`. */
    versionLabel: string;
    /** Shown in place of the version while nothing is saved. */
    unsaved: string;
    replacePdf: string;
    /** Shown after uploading, until it's saved with the template. */
    pdfUploaded: string;
    /** Warning for a large base PDF, with its size in `{size}`, such as "2.4 MB". */
    largePdf: string;
    addFont: string;
    /** Heading of the stored fonts in the font menu. */
    storedFonts: string;
    /** Shown in the font menu when every stored font is already loaded. */
    noStoredFonts: string;
    uploadFont: string;
    /** Shown while no font is loaded, so only the QR code can be placed. */
    needsFont: string;
    /** Sidebar labels of the field types. */
    fields: { participantName: string; issueDate: string; qrcode: string };
    /** Name new participant name fields show. */
    sampleName: string;
    missingGlyphsTitle: string;
    missingGlyphsText: string;
    /** One field, with `{field}`, the missing `{characters}` and its `{font}`. */
    missingGlyphsItem: string;
    /** With the font's family and style in `{family}` and `{style}`. */
    fontAdded: string;
    save: string;
    /** With the new version number in `{version}`. */
    saved: string;
  };
};

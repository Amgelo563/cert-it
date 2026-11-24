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
    /** What a version is, under its number. */
    versionHelp: string;
    /** Next to the version while the canvas differs from it. */
    unsavedChanges: string;
    replacePdf: string;
    /** Shown after uploading, until it's saved with the template. */
    pdfUploaded: string;
    /** Warning for a large base PDF, with its size in `{size}`, such as "2.4 MB". */
    largePdf: string;
    /** The toolbar button that opens the template's fonts. */
    fonts: string;
    fontsModal: {
      title: string;
      /** Tabs: the stored fonts, and uploading a file. The catalog's tab shows its own name. */
      stored: string;
      upload: string;
      searchStored: string;
      /** Headings of the stored fonts: the template's, then the rest. */
      inTemplate: string;
      otherStored: string;
      noMatches: string;
      uploadTitle: string;
      uploadText: string;
    };
    /** Shown when no font is stored at all. */
    noStoredFonts: string;
    /** After taking a `{font}` out of the template. */
    fontRemoved: string;
    /** A `{font}` that can't be taken out, as the listed `{fields}` use it. */
    fontInUse: string;
    /** The font catalog's search and import. */
    catalog: {
      searchPlaceholder: string;
      noResults: string;
      style: string;
      styleHint: string;
      /** A style, with its `{weight}`, such as 400. */
      weight: string;
      italicWeight: string;
      subset: string;
      subsetHint: string;
      import: string;
      /** Heading of the sample name drawn in the picked style. */
      preview: string;
    };
    /** Shown while no font is loaded, so only the QR code can be placed. */
    needsFont: string;
    /** Names new fields get, by type; repeats get a number, such as "Name 2". */
    fieldNames: { participantName: string; issueDate: string; qrcode: string };
    /** Sidebar labels of the field types. */
    fields: { participantName: string; issueDate: string; qrcode: string };
    /** Name new participant name fields show. */
    sampleName: string;
    /** Lead of the one-line warning, before its fields. */
    missingGlyphsTitle: string;
    /** After the fields: what happens and what to do. */
    missingGlyphsText: string;
    /** One field, with `{field}`, the missing `{characters}` and its `{font}`. */
    missingGlyphsItem: string;
    /** With the font's family and style in `{family}` and `{style}`. */
    fontAdded: string;
    save: string;
    /** Confirmation before saving a version that doesn't print the participant's name. */
    noNameTitle: string;
    noNameText: string;
    saveAnyway: string;
    /** With the new version number in `{version}`. */
    saved: string;
    /** The certificate generated in the browser from the canvas. */
    preview: {
      open: string;
      title: string;
      sample: string;
      participant: string;
      searchParticipant: string;
      noParticipants: string;
      searchFailed: string;
      pickHint: string;
      /** Shown for a participant without a certificate, whose date and QR code are samples. */
      notIssued: string;
      /** With the participant's `{name}`. */
      missingGlyphsTitle: string;
      missingGlyphsText: string;
      /** With the error in `{reason}`. */
      failed: string;
      imageAlt: string;
      download: string;
      /** Name of the downloaded file of a sample preview, without its extension. */
      sampleFile: string;
    };
  };
};

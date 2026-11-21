import type { CourseMessages } from './CourseMessages';

export const EnCourseMessages = {
  courses: {
    title: 'Courses',
    description: 'Courses and events whose participants get certificates',
    add: 'New course',
    listTitle: 'All courses',
    count: '{count} in total',
    empty: 'No courses yet.',
    name: 'Name',
    locale: 'Language',
    localeDescription: 'Used for the certificates and the public pages',
    dateFormat: 'Date format',
    dateFormatDescription:
      'D day, M month number, MMMM month name, YYYY year. Text in [brackets] is kept as is.',
    datePreview: 'Today: {date}',
    lookupEnabled: 'Show in the public lookup',
    lookupDescription:
      'Participants can find their certificate on the lookup page by email',
    participants: 'Participants',
    certificates: 'Certificates',
    revokedCount: '{count} revoked',
    lookup: 'Lookup',
    listed: 'Listed',
    hidden: 'Hidden',
    archived: 'Archived',
    createdAt: 'Created',
    backToList: 'All courses',
    tabsLabel: 'Course sections',
    tabs: {
      participants: 'Participants',
      template: 'Template',
      settings: 'Settings',
    },
    listedInLookup: 'Listed in the lookup',
    hiddenFromLookup: 'Hidden from the lookup',
    revoked: 'Revoked',
    generalTitle: 'General',
    saveSubmit: 'Save changes',
    discard: 'Discard changes',
    archiveSection: 'Archive the course',
    archiveSectionText:
      'Archived courses leave the public lookup. Their certificates stay valid and can still be opened from their links.',
    unarchiveSectionText:
      "This course is archived, so it isn't in the public lookup. Unarchive it to list it again.",
    deleteSection: 'Delete the course',
    deleteSectionText:
      "Deletes the course with its participants and certificates. Certificate links stop working. This can't be undone.",
    archive: 'Archive',
    archiveTitle: 'Archive this course?',
    archiveText:
      '{name} will leave the public lookup. Its certificates stay valid and can still be opened from their links.',
    archivedNotice: '{name} was archived.',
    unarchive: 'Unarchive',
    unarchivedNotice: '{name} was unarchived.',
    delete: 'Delete',
    deleteTitle: 'Delete this course?',
    deleteText:
      "{name}, its {participants} participants and its {certificates} certificates will be deleted for good, and certificate links will stop working. This can't be undone.",
    deleted: '{name} was deleted.',
    addTitle: 'New course',
    addSubmit: 'Create course',
    added: '{name} was created.',
    saved: '{name} was saved.',
    fieldRequired: 'Fill in this field.',
  },
  template: {
    emptyTitle: 'No template yet',
    emptyText:
      "This course doesn't have a certificate template. Drop its base PDF here, or click to choose it.",
    versionLabel: 'Version {version}',
    unsaved: 'Not saved yet',
    replacePdf: 'Replace base PDF',
    pdfUploaded: 'Base PDF uploaded. Save to keep it in the template.',
    largePdf:
      'This PDF is {size}. Every certificate carries a full copy, so it multiplies disk use and generation time.',
    addFont: 'Add font',
    storedFonts: 'Stored fonts',
    noStoredFonts: 'No other stored fonts',
    uploadFont: 'Upload font file…',
    needsFont:
      'Add a font to place the participant name and the date. Only the QR code can be placed without one.',
    fields: {
      participantName: 'Participant name',
      issueDate: 'Issue date',
      qrcode: 'QR code',
    },
    sampleName: 'María José Núñez',
    missingGlyphsTitle: "Some characters can't be printed",
    missingGlyphsText:
      "These fields use a font without them, so they'd print as blanks. Pick another font, or check the sample text.",
    missingGlyphsItem: '{field}: {characters} (missing in {font})',
    fontAdded: '{family} {style} added',
    save: 'Save version',
    saved: 'Saved as version {version}',
  },
} satisfies CourseMessages;

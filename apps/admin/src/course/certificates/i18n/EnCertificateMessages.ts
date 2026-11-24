import type { CertificateMessages } from './CertificateMessages';

export const EnCertificateMessages = {
  certificates: {
    count: '{count} listed',
    searchPlaceholder: 'Search by name or email',
    filterLabel: 'Certificate status',
    filters: {
      all: 'All',
      none: 'Not issued',
      active: 'Active',
      revoked: 'Revoked',
    },
    empty: 'No participants with this status.',
    noMatches: 'No participants match the search.',
    participant: 'Participant',
    certificate: 'Certificate',
    issueDate: 'Issue date',
    notIssued: 'Not issued',
    active: 'Active',
    revoked: 'Revoked',
    revokedReason: 'Reason: {reason}',
    templateVersion: 'Template v{version}',
    olderTemplate: 'Template v{version}, latest is v{latest}',
    openPdf: 'Open PDF',
    actions: 'Actions for {name}',
    select: 'Select {name}',
    selectAll: 'Select this page',
    issueAll: 'Issue to everyone without one',
    issueSelected: 'Issue to selected ({count})',
    clearSelection: 'Clear selection',
    noTemplate: 'Save a template before issuing certificates.',
    noNameField:
      "The latest template doesn't print the participant's name. Add a name field and save a new version before issuing certificates.",
    openTemplate: 'Go to the template',
    issueTitle: 'Issue certificates',
    issueAllText:
      'Participants without a certificate: {count}. Each one will get a certificate with a new code, made from the latest template.',
    issueSelectedText:
      'Selected participants: {count}. Each one will get a certificate with a new code, made from the latest template.',
    issueDateLabel: 'Issue date',
    issueDateDescription:
      'Printed on the certificates as shown here. Leave it empty to use today.',
    issueDateToday: 'Today: {date}',
    issueSubmit: 'Issue',
    issueStarted: 'Issuing certificates in the background: {count}.',
    revoke: 'Revoke',
    revokeTitle: 'Revoke certificate',
    revokeText:
      "{name}'s certificate {code} will stop being valid right away. Its page will show it as revoked, and its PDF can no longer be downloaded. You can reinstate it later.",
    reasonLabel: 'Reason',
    reasonDescription:
      'Kept in the audit log and shown on the certificate page',
    reasonRequired: 'Give a reason',
    revokeSubmit: 'Revoke',
    revokedNotice: "{name}'s certificate was revoked.",
    reinstate: 'Reinstate',
    reinstateTitle: 'Reinstate certificate',
    reinstateText:
      "{name}'s certificate {code} becomes valid again, with the same code and PDF.",
    reinstatedNotice: "{name}'s certificate was reinstated.",
    edit: 'Edit',
    editTitle: 'Edit certificate',
    editText:
      'The PDF is made again with the new details, keeping the same code and template version.',
    nameLabel: 'Name',
    nameDescription: 'As it should be printed on the certificate',
    nameRequired: 'Enter a name',
    dateRequired: 'Pick a date',
    editSubmit: 'Save and render',
    editStarted: "Updating {name}'s certificate.",
    delete: 'Delete',
    deleteTitle: 'Delete certificate',
    deleteText:
      "This permanently deletes {name}'s certificate {code} and its PDF, and the code stops working. Only use this for certificates issued by mistake. To cancel a valid certificate, revoke it instead.",
    deletedNotice: "{name}'s certificate was deleted.",
    outdatedNotice:
      'Certificates on an older template version: {count}. Regenerate them to use the latest one.',
    outdatedReview: 'Review',
    export: 'Export',
    exportZip: 'Active PDFs (ZIP)',
    exportCsv: 'Codes and URLs (CSV)',
  },
  regenerate: {
    title: 'Regenerate certificates',
    text: 'Certificates on an older version: {count}. Regenerating remakes them with template v{version} and keeps their codes and dates.',
    fromVersion: 'v{version}',
    selectAll: 'All',
    select: 'Select {name}',
    notNow: 'Not now',
    submit: 'Regenerate ({count})',
    started: 'Regenerating certificates in the background: {count}.',
    startedElsewhere:
      'Regenerating certificates in the background: {count}. Follow the progress on the Certificates tab.',
  },
  certificateJob: {
    titles: {
      issue: {
        pending: 'Waiting to start',
        running: 'Issuing certificates',
        completed: 'Certificates issued',
        failed: 'Issuing stopped',
      },
      regenerate: {
        pending: 'Waiting to start',
        running: 'Regenerating certificates',
        completed: 'Certificates regenerated',
        failed: 'Regenerating stopped',
      },
    },
    progress: '{progress} of {total}',
    rendered: 'Done: {count}',
    skippedTitle: 'Left out: {count}',
    skippedText:
      "The template's fonts are missing some characters in these participants' details. Add a font that has them, then try again.",
    missingCharacters: '{field}: {characters}',
    failedText:
      'The job stopped: {error}. Certificates already made are kept, and retrying makes the rest.',
    retry: 'Retry',
    dismiss: 'Dismiss',
  },
} satisfies CertificateMessages;

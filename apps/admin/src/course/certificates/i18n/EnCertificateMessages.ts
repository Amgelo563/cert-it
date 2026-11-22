import type { CertificateMessages } from './CertificateMessages';

export const EnCertificateMessages = {
  certificates: {
    count: '{count} listed',
    searchPlaceholder: 'Search by name or email',
    filterLabel: 'Certificate state',
    filters: {
      all: 'All',
      none: 'Not issued',
      active: 'Active',
      revoked: 'Revoked',
    },
    empty: 'No participants in this state.',
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
    issueAll: 'Issue to all without one',
    issueSelected: 'Issue to selected ({count})',
    clearSelection: 'Clear selection',
    noTemplate: 'Save a template before issuing certificates.',
    issueTitle: 'Issue certificates',
    issueAllText:
      'Participants without a certificate: {count}. Each gets one with a new code, rendered with the latest template.',
    issueSelectedText:
      'Selected participants: {count}. Each gets a certificate with a new code, rendered with the latest template.',
    issueDateLabel: 'Issue date',
    issueDateDescription:
      'Printed on the certificates. Leave it empty to use today.',
    issueSubmit: 'Issue',
    issueStarted: 'Issuing in the background: {count}.',
    revoke: 'Revoke',
    revokeTitle: 'Revoke certificate',
    revokeText:
      "{name}'s certificate {code} stops being valid at once: its page shows it as revoked and its PDF is no longer served. You can reinstate it later.",
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
  },
  certificateJob: {
    titles: {
      pending: 'Waiting to start',
      running: 'Issuing certificates',
      completed: 'Certificates issued',
      failed: 'Issuing stopped',
    },
    progress: '{progress} of {total}',
    rendered: 'Total: {count}',
    skippedTitle: 'Left out: {count}',
    skippedText:
      "The template's fonts can't draw some characters of their data. Add a font that has them, then issue again.",
    missingCharacters: '{field}: {characters}',
    failedText:
      'The job stopped: {error}. Certificates already made are kept; retrying makes the rest.',
    retry: 'Retry',
    dismiss: 'Dismiss',
  },
} satisfies CertificateMessages;

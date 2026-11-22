import type { JobStatus, ParticipantCertificateFilter } from '@cert-it/shared';

/** Texts of a course's certificates tab. Placeholders are written as `{key}`. */
export type CertificateMessages = {
  certificates: {
    /** With the number of listed participants in `{count}`. */
    count: string;
    searchPlaceholder: string;
    /** Accessible label of the certificate state filter. */
    filterLabel: string;
    /** Names of the filter's options; `all` lists everyone. */
    filters: Record<ParticipantCertificateFilter | 'all', string>;
    empty: string;
    noMatches: string;
    participant: string;
    certificate: string;
    issueDate: string;
    notIssued: string;
    active: string;
    revoked: string;
    /** The reason under a revoked certificate, in `{reason}`. */
    revokedReason: string;
    /** The certificate's template version, in `{version}`. */
    templateVersion: string;
    /** A certificate on an old template, with its `{version}` and the course's `{latest}`. */
    olderTemplate: string;
    openPdf: string;
    /** Accessible label of a row's actions menu, with the participant's `{name}`. */
    actions: string;
    /** Accessible label of a row's checkbox, with the participant's `{name}`. */
    select: string;
    /** Accessible label of the checkbox that checks the whole page. */
    selectAll: string;
    /** Button that issues to everyone without a certificate. */
    issueAll: string;
    /** Button that issues to the checked rows, with their `{count}`. */
    issueSelected: string;
    clearSelection: string;
    /** Shown instead of the issue buttons while the course has no template. */
    noTemplate: string;
    issueTitle: string;
    /** What will be issued to everyone without one, in `{count}`. */
    issueAllText: string;
    /** What will be issued to the checked rows, in `{count}`. */
    issueSelectedText: string;
    issueDateLabel: string;
    issueDateDescription: string;
    issueSubmit: string;
    /** Notice after the job is added, with its `{count}`. */
    issueStarted: string;
    revoke: string;
    revokeTitle: string;
    /** With the participant's `{name}` and the certificate's `{code}`. */
    revokeText: string;
    reasonLabel: string;
    reasonDescription: string;
    reasonRequired: string;
    revokeSubmit: string;
    /** With the participant's `{name}`. */
    revokedNotice: string;
    reinstate: string;
    reinstateTitle: string;
    /** With the participant's `{name}` and the certificate's `{code}`. */
    reinstateText: string;
    /** With the participant's `{name}`. */
    reinstatedNotice: string;
  };
  certificateJob: {
    /** Title of the panel, by the job's status. */
    titles: Record<JobStatus, string>;
    /** Progress of a running job, in `{progress}` of `{total}`. */
    progress: string;
    /** Result of a finished job, with the certificates issued in `{count}`. */
    rendered: string;
    /** Heading of the participants left out, with their `{count}`. */
    skippedTitle: string;
    skippedText: string;
    /** One left-out participant's missing characters, with the field's `{field}` and the characters in `{characters}`. */
    missingCharacters: string;
    /** Why a failed job stopped, in `{error}`. */
    failedText: string;
    retry: string;
    dismiss: string;
  };
};

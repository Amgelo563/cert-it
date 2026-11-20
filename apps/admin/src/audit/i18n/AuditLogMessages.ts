import type { AuditActionEnum, AuditEntityEnum } from '@cert-it/shared';

/** Texts of the audit log. Placeholders are written as `{key}`. */
export type AuditLogMessages = {
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
};

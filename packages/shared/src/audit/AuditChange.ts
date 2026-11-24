import type { AuditDetailsMap } from './AuditDetailsMap';

/** An audited action on the given kind of model, with the details that action records. */
export type AuditChange<Entity extends keyof AuditDetailsMap> = {
  [Action in keyof AuditDetailsMap[Entity]]: {
    readonly action: Action;
    readonly details: AuditDetailsMap[Entity][Action];
  };
}[keyof AuditDetailsMap[Entity]];

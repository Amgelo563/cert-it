import type { AuditChange } from './AuditChange';
import type { AuditDetailsMap } from './AuditDetailsMap';

/** An audited change: the model, the action and the details that pair records. */
export type AuditRecord = {
  [Entity in keyof AuditDetailsMap]: AuditChange<Entity> & {
    readonly entity: Entity;
  };
}[keyof AuditDetailsMap];

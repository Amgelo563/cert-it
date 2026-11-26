import type { ImportMode } from '../api/participant/ImportParticipantsRequest';
import type { ImportRowStatus } from '../api/participant/ImportParticipantsResponse';
import type { CourseFieldType } from '../field/CourseFieldTypeEnum';
import type { FontSource } from '../font/FontSourceEnum';
import type { Locale } from '../i18n/LocaleEnum';
import type { Role } from '../role/RoleEnum';
import type { AuditActionEnum } from './AuditActionEnum';
import type { AuditEntityEnum } from './AuditEntityEnum';

type NoDetails = Readonly<Record<string, never>>;

type CourseDetails = {
  readonly name: string;
  readonly locale: Locale;
  readonly dateFormat: string;
  readonly lookupEnabled: boolean;
  readonly active: boolean;
};

type JobRetryDetails = { readonly courseId: number; readonly retry: true };

/** The details each pair of audited model and action records, by entity and then by action. */
export type AuditDetailsMap = {
  [AuditEntityEnum.User]: {
    [AuditActionEnum.Create]: { readonly name: string; readonly role: Role };
    [AuditActionEnum.Update]: {
      readonly name?: string;
      readonly role?: Role;
      readonly active?: boolean;
    };
    [AuditActionEnum.Login]: NoDetails;
    [AuditActionEnum.ChangePassword]: NoDetails;
    [AuditActionEnum.ResetPassword]: NoDetails;
  };
  [AuditEntityEnum.Course]: {
    [AuditActionEnum.Create]: Pick<CourseDetails, 'name'>;
    [AuditActionEnum.Update]: Partial<CourseDetails>;
    [AuditActionEnum.Delete]: Pick<CourseDetails, 'name'>;
    [AuditActionEnum.Import]: Readonly<Record<ImportRowStatus, number>> & {
      readonly mode: ImportMode;
    };
    /** Labels of the course's fields, in their new order. */
    [AuditActionEnum.Reorder]: { readonly fields: readonly string[] };
  };
  [AuditEntityEnum.CourseField]: {
    [AuditActionEnum.Create]: {
      readonly courseId: number;
      readonly label: string;
      readonly type: CourseFieldType;
      readonly required: boolean;
    };
    [AuditActionEnum.Update]: {
      readonly courseId: number;
      readonly label?: string;
      readonly type?: CourseFieldType;
      readonly required?: boolean;
    };
    /** How many participants lost a value, and the template version made without the field, if any. */
    [AuditActionEnum.Delete]: {
      readonly courseId: number;
      readonly label: string;
      readonly values: number;
      readonly templateVersion?: number;
    };
  };
  [AuditEntityEnum.Participant]: {
    [AuditActionEnum.Create]: { readonly email: string };
    [AuditActionEnum.Update]: {
      readonly name?: string;
      readonly email?: string;
      /** Labels of the fields whose value changed. */
      readonly fields?: readonly string[];
    };
    [AuditActionEnum.Delete]: { readonly name: string; readonly email: string };
  };
  [AuditEntityEnum.Font]: {
    [AuditActionEnum.Create]: {
      readonly family: string;
      readonly style: string;
      readonly source: FontSource;
    };
  };
  [AuditEntityEnum.TemplateVersion]: {
    [AuditActionEnum.Create]: {
      readonly courseId: number;
      readonly version: number;
    };
    [AuditActionEnum.Update]: {
      readonly courseId: number;
      readonly version: number;
    };
  };
  [AuditEntityEnum.Certificate]: {
    [AuditActionEnum.Update]: {
      readonly code: string;
      readonly name?: string;
      readonly issueDate?: string;
    };
    /** The participant's name, unless they were already gone. */
    [AuditActionEnum.Delete]: { readonly code: string; readonly name?: string };
    [AuditActionEnum.Revoke]: {
      readonly code: string;
      readonly reason: string;
    };
    [AuditActionEnum.Reinstate]: { readonly code: string };
  };
  [AuditEntityEnum.Job]: {
    [AuditActionEnum.Issue]:
      | JobRetryDetails
      | {
          readonly courseId: number;
          readonly retry: false;
          readonly participants: number;
          readonly issueDate: string;
        };
    [AuditActionEnum.Regenerate]:
      | JobRetryDetails
      | {
          readonly courseId: number;
          readonly retry: false;
          readonly certificates: number;
          readonly templateVersion: number;
        };
  };
};

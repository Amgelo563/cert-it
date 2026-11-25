import {
  CourseFieldTypeEnum,
  dateOrderOf,
  detectFieldDateOrder,
  type FieldDateOrder,
  FieldValueErrorEnum,
  type FieldValues,
  hasAmbiguousDates,
  type ImportFieldError,
  type ImportMode,
  ImportModeEnum,
  type ImportRow,
  type ImportRowError,
  ImportRowErrorEnum,
  type ImportRowResult,
  type ImportRowStatus,
  ImportRowStatusEnum,
  ImportSkipReasonEnum,
  parseFieldCell,
  ParticipantFields,
} from '@cert-it/shared';
import { Result } from 'better-result';
import type { Course } from '../../course/Course';
import type { DatabaseService } from '../../database/DatabaseService';
import type { Repositories } from '../../database/Repositories';
import { type CourseField, listMissingRequired } from '../../field/CourseField';
import {
  type NormalizedEmail,
  normalizeEmail,
} from '../../util/email/NormalizedEmail';
import type { ImportOutcome, ParticipantChange } from './ImportOutcome';

type ParticipantImporterOptions = {
  database: DatabaseService;
};

type ImportOptions = {
  course: Course;
  rows: readonly ImportRow[];
  mode: ImportMode;
  dryRun: boolean;
  /** Image file names the rows give that aren't stored; empty on a dry run, whose images aren't uploaded yet. */
  missingImages?: ReadonlySet<string>;
};

/** A row that passed its own checks, ready to save once required fields are checked. */
type ValidRow = {
  name: string;
  email: NormalizedEmail;
  /** The row's non-empty values, by field ID. */
  values: FieldValues;
};

type CheckedRow =
  | ValidRow
  | { errors: ImportRowError[]; fieldErrors: ImportFieldError[] };

/** Imports participants into a course, or reports what an import would do. */
export class ParticipantImporter {
  protected readonly database: DatabaseService;

  constructor(options: ParticipantImporterOptions) {
    this.database = options.database;
  }

  /** Returns the image file names the rows give for the course's image fields, each once. */
  public static listImages(
    fields: readonly CourseField[],
    rows: readonly ImportRow[],
  ): string[] {
    const ids = fields
      .filter((field) => field.type === CourseFieldTypeEnum.Image)
      .map((field) => String(field.id));
    return [
      ...new Set(
        rows.flatMap((row) =>
          ids.flatMap((id) => {
            const cell = row.fields?.[id]?.trim();
            return cell ? [cell] : [];
          }),
        ),
      ),
    ];
  }

  /**
   * Checks every row and saves the valid ones, all in one transaction.
   *
   * A dry run does the same work and rolls it back, so its report matches what the import would do.
   * Participants whose name or values changed are returned too, since their certificates may have to be rendered again.
   */
  public run(options: ImportOptions): ImportOutcome {
    const { dryRun } = options;
    const changed: ParticipantChange[] = [];
    // an error result is how a transaction is rolled back
    const outcome = this.database
      .getUnitOfWork()
      .transaction((repositories) => {
        const results = this.apply(repositories, options, changed);
        return dryRun ? Result.err(results) : Result.ok(results);
      });
    const { rows, dateOrders } = outcome.isOk() ? outcome.value : outcome.error;

    return {
      response: {
        dryRun,
        totals: ParticipantImporter.countStatuses(rows),
        rows,
        dateOrders,
      },
      // nothing was saved on a dry run
      changed: dryRun ? [] : changed,
    };
  }

  protected apply(
    repositories: Repositories,
    options: ImportOptions,
    changed: ParticipantChange[],
  ): { rows: ImportRowResult[]; dateOrders: Record<string, FieldDateOrder> } {
    const { course, rows, mode } = options;
    const { participants, courseFields } = repositories;
    const fields = courseFields.listByCourse(course.id);
    const dateOrders = ParticipantImporter.dateOrdersOf(course, fields, rows);
    const checked = rows.map((row) =>
      ParticipantImporter.check(row, {
        course,
        fields,
        dateOrders,
        missingImages: options.missingImages ?? new Set(),
      }),
    );
    const existing = new Map(
      participants
        .listByEmails(course.id, [
          ...new Set(
            checked.flatMap((row) => ('email' in row ? [row.email] : [])),
          ),
        ])
        .map((participant) => [participant.email, participant]),
    );
    // the first valid row with an email claims it
    const claimed = new Map<NormalizedEmail, number>();
    const fieldIds = new Set(fields.map((field) => String(field.id)));

    const results = checked.map((row, index): ImportRowResult => {
      if ('errors' in row) {
        return ParticipantImporter.invalid(index, row.errors, row.fieldErrors);
      }

      const earlier = claimed.get(row.email);
      if (earlier !== undefined) {
        return {
          row: index,
          status: ImportRowStatusEnum.Skip,
          reason: ImportSkipReasonEnum.DuplicateInFile,
          duplicateOf: earlier,
        };
      }

      const current = existing.get(row.email);
      if (current && mode === ImportModeEnum.Skip) {
        claimed.set(row.email, index);
        return {
          row: index,
          status: ImportRowStatusEnum.Skip,
          reason: ImportSkipReasonEnum.Exists,
          existingName: current.name,
        };
      }

      // values of fields deleted since stay out
      const kept = Object.fromEntries(
        Object.entries(current?.fieldValues ?? {}).filter(([id]) =>
          fieldIds.has(id),
        ),
      );
      const values = { ...kept, ...row.values };
      const missing = listMissingRequired(fields, values);
      if (missing.length > 0) {
        return ParticipantImporter.invalid(
          index,
          [],
          missing.map((field) => ({
            fieldId: field.id,
            error: FieldValueErrorEnum.Required,
          })),
        );
      }
      claimed.set(row.email, index);

      if (!current) {
        participants
          .create({
            courseId: course.id,
            name: row.name,
            email: row.email,
            fieldValues: values,
          })
          .unwrap();
        return { row: index, status: ImportRowStatusEnum.Create };
      }

      const changedIds = ParticipantImporter.changedFieldIds(kept, values);
      if (current.name === row.name && changedIds.length === 0) {
        return {
          row: index,
          status: ImportRowStatusEnum.Skip,
          reason: ImportSkipReasonEnum.Unchanged,
          existingName: current.name,
        };
      }
      const updated = participants
        .update(current.id, { name: row.name, fieldValues: values })
        .unwrap();
      changed.push({
        participant: updated,
        renamed: updated.name !== current.name,
        fieldIds: changedIds,
      });
      return {
        row: index,
        status: ImportRowStatusEnum.Update,
        existingName: current.name,
      };
    });

    return { rows: results, dateOrders: dateOrders.reported };
  }

  // the same rules as adding a participant by hand
  protected static check(
    row: ImportRow,
    context: {
      course: Course;
      fields: readonly CourseField[];
      dateOrders: { all: ReadonlyMap<string, FieldDateOrder> };
      missingImages: ReadonlySet<string>;
    },
  ): CheckedRow {
    const errors: ImportRowError[] = [];
    const name = ParticipantFields.name.safeParse(row.name);
    if (!name.success) {
      errors.push(
        row.name.trim() === ''
          ? ImportRowErrorEnum.NameRequired
          : ImportRowErrorEnum.NameTooLong,
      );
    }
    const email = ParticipantFields.email.safeParse(row.email);
    if (!email.success) errors.push(ImportRowErrorEnum.EmailInvalid);

    const { values, fieldErrors } = ParticipantImporter.readFields(
      row,
      context,
    );
    if (!name.success || !email.success || fieldErrors.length > 0) {
      return { errors, fieldErrors };
    }
    return { name: name.data, email: normalizeEmail(email.data), values };
  }

  // cells of fields deleted since are left out
  protected static readFields(
    row: ImportRow,
    context: {
      course: Course;
      fields: readonly CourseField[];
      dateOrders: { all: ReadonlyMap<string, FieldDateOrder> };
      missingImages: ReadonlySet<string>;
    },
  ): { values: FieldValues; fieldErrors: ImportFieldError[] } {
    const { course, fields, dateOrders, missingImages } = context;
    const values: Record<string, FieldValues[string]> = {};
    const fieldErrors: ImportFieldError[] = [];

    for (const field of fields) {
      const id = String(field.id);
      const fileError = row.fileErrors?.[id];
      if (fileError) {
        fieldErrors.push({ fieldId: field.id, error: fileError });
        continue;
      }
      const cell = row.fields?.[id];
      if (cell === undefined) continue;

      const parsed = parseFieldCell(field.type, cell, {
        dateOrder: dateOrders.all.get(id) ?? dateOrderOf(course.locale),
        dateFormat: course.dateFormat,
        locale: course.locale,
      });
      if ('error' in parsed) {
        fieldErrors.push({ fieldId: field.id, error: parsed.error });
      } else if ('value' in parsed) {
        if (
          field.type === CourseFieldTypeEnum.Image
          && missingImages.has(String(parsed.value))
        ) {
          fieldErrors.push({
            fieldId: field.id,
            error: FieldValueErrorEnum.ImageNotUploaded,
          });
        } else {
          values[id] = parsed.value;
        }
      }
    }
    return { values, fieldErrors };
  }

  // per column: the order its values show, or the course's, reported when some value could be read either way
  protected static dateOrdersOf(
    course: Course,
    fields: readonly CourseField[],
    rows: readonly ImportRow[],
  ): {
    all: ReadonlyMap<string, FieldDateOrder>;
    reported: Record<string, FieldDateOrder>;
  } {
    const all = new Map<string, FieldDateOrder>();
    const reported: Record<string, FieldDateOrder> = {};

    for (const field of fields) {
      if (field.type !== CourseFieldTypeEnum.Date) continue;
      const id = String(field.id);
      const cells = rows.flatMap((row) => {
        const cell = row.fields?.[id];
        return cell === undefined ? [] : [cell];
      });
      const order = detectFieldDateOrder(cells) ?? dateOrderOf(course.locale);
      all.set(id, order);
      if (hasAmbiguousDates(cells)) reported[id] = order;
    }
    return { all, reported };
  }

  protected static changedFieldIds(
    current: FieldValues,
    next: FieldValues,
  ): number[] {
    const ids = new Set([...Object.keys(current), ...Object.keys(next)]);
    return [...ids].filter((id) => current[id] !== next[id]).map(Number);
  }

  protected static invalid(
    row: number,
    errors: readonly ImportRowError[],
    fieldErrors: readonly ImportFieldError[],
  ): ImportRowResult {
    return {
      row,
      status: ImportRowStatusEnum.Invalid,
      ...(errors.length > 0 ? { errors } : {}),
      ...(fieldErrors.length > 0 ? { fieldErrors } : {}),
    };
  }

  protected static countStatuses(
    rows: readonly ImportRowResult[],
  ): Record<ImportRowStatus, number> {
    const totals: Record<ImportRowStatus, number> = {
      [ImportRowStatusEnum.Create]: 0,
      [ImportRowStatusEnum.Update]: 0,
      [ImportRowStatusEnum.Skip]: 0,
      [ImportRowStatusEnum.Invalid]: 0,
    };
    for (const { status } of rows) totals[status] += 1;
    return totals;
  }
}

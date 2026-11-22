import {
  type ImportMode,
  ImportModeEnum,
  type ImportRow,
  type ImportRowError,
  ImportRowErrorEnum,
  type ImportRowResult,
  type ImportRowStatus,
  ImportRowStatusEnum,
  ImportSkipReasonEnum,
  ParticipantFields,
} from '@cert-it/shared';
import { Result } from 'better-result';
import type { CourseId } from '../../course/Course';
import type { DatabaseService } from '../../database/DatabaseService';
import type { Repositories } from '../../database/Repositories';
import {
  type NormalizedEmail,
  normalizeEmail,
} from '../../util/email/NormalizedEmail';
import type { Participant } from '../Participant';
import type { ImportOutcome } from './ImportOutcome';

type ParticipantImporterOptions = {
  database: DatabaseService;
};

/** A row that passed its checks, ready to save. */
type ValidRow = {
  name: string;
  email: NormalizedEmail;
  extra: Readonly<Record<string, string>>;
};

/** Imports participants into a course, or reports what an import would do. */
export class ParticipantImporter {
  protected readonly database: DatabaseService;

  constructor(options: ParticipantImporterOptions) {
    this.database = options.database;
  }

  /**
   * Checks every row and saves the valid ones, all in one transaction.
   *
   * A dry run does the same work and rolls it back, so its report matches what the import would do.
   * Renamed participants are returned too, since their certificates must be rendered again.
   */
  public run(options: {
    courseId: CourseId;
    rows: readonly ImportRow[];
    mode: ImportMode;
    dryRun: boolean;
  }): ImportOutcome {
    const { dryRun } = options;
    const renamed: Participant[] = [];
    // an error result is how a transaction is rolled back
    const outcome = this.database
      .getUnitOfWork()
      .transaction((repositories) => {
        const results = this.apply(repositories, options, renamed);
        return dryRun ? Result.err(results) : Result.ok(results);
      });
    const rows = outcome.isOk() ? outcome.value : outcome.error;

    return {
      response: {
        dryRun,
        totals: ParticipantImporter.countStatuses(rows),
        rows,
      },
      // nothing was saved on a dry run
      renamed: dryRun ? [] : renamed,
    };
  }

  protected apply(
    repositories: Repositories,
    options: {
      courseId: CourseId;
      rows: readonly ImportRow[];
      mode: ImportMode;
    },
    renamed: Participant[],
  ): ImportRowResult[] {
    const { courseId, rows, mode } = options;
    const { participants } = repositories;
    const checked = rows.map((row) => ParticipantImporter.check(row));
    const existing = new Map(
      participants
        .listByEmails(courseId, [
          ...new Set(
            checked.flatMap((row) => ('email' in row ? [row.email] : [])),
          ),
        ])
        .map((participant) => [participant.email, participant]),
    );
    // the first valid row with an email claims it
    const claimed = new Map<NormalizedEmail, number>();

    return checked.map((row, index): ImportRowResult => {
      if ('errors' in row) {
        return {
          row: index,
          status: ImportRowStatusEnum.Invalid,
          errors: row.errors,
        };
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
      claimed.set(row.email, index);

      const current = existing.get(row.email);
      if (!current) {
        participants.create({ courseId, ...row }).unwrap();
        return { row: index, status: ImportRowStatusEnum.Create };
      }
      if (mode === ImportModeEnum.Skip) {
        return {
          row: index,
          status: ImportRowStatusEnum.Skip,
          reason: ImportSkipReasonEnum.Exists,
          existingName: current.name,
        };
      }

      const extra = { ...current.extra, ...row.extra };
      if (ParticipantImporter.isUnchanged(current, row.name, extra)) {
        return {
          row: index,
          status: ImportRowStatusEnum.Skip,
          reason: ImportSkipReasonEnum.Unchanged,
          existingName: current.name,
        };
      }
      const updated = participants
        .update(current.id, { name: row.name, extra })
        .unwrap();
      if (updated.name !== current.name) renamed.push(updated);
      return {
        row: index,
        status: ImportRowStatusEnum.Update,
        existingName: current.name,
      };
    });
  }

  // the same rules as adding a participant by hand
  protected static check(
    row: ImportRow,
  ): ValidRow | { errors: ImportRowError[] } {
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
    if (!name.success || !email.success) return { errors };

    const extra = Object.fromEntries(
      Object.entries(row.extra ?? {})
        .map(([key, value]) => [key.trim(), value.trim()] as const)
        .filter(([, value]) => value !== ''),
    );
    return { name: name.data, email: normalizeEmail(email.data), extra };
  }

  protected static isUnchanged(
    current: Participant,
    name: string,
    extra: Readonly<Record<string, string>>,
  ): boolean {
    const keys = Object.keys(extra);
    return (
      current.name === name
      && keys.length === Object.keys(current.extra).length
      && keys.every((key) => current.extra[key] === extra[key])
    );
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

import { BackupFileName } from '../archive/BackupFileName';

type BackupRetentionOptions = {
  /** How long a backup is kept. */
  days: number;
  /** How many backups are kept at most, the newest ones. @default no limit */
  copies?: number | null;
};

/** Decides which backups on a remote are old enough to delete. */
export class BackupRetention {
  protected static readonly DayMs = 24 * 60 * 60 * 1000;

  protected readonly days: number;

  protected readonly copies: number | null;

  constructor(options: BackupRetentionOptions) {
    this.days = options.days;
    this.copies = options.copies ?? null;
  }

  /** Returns the backups to delete among the given file names: those older than the kept days or past the kept copies. Other files are never picked. */
  public selectExpired(names: readonly string[], now: Date): string[] {
    const cutoff = now.getTime() - this.days * BackupRetention.DayMs;
    const backups = names
      .map((name) => ({ name, date: BackupFileName.parse(name) }))
      .filter(
        (backup): backup is { name: string; date: Date } =>
          backup.date !== null,
      )
      .toSorted((a, b) => b.date.getTime() - a.date.getTime());

    return backups
      .filter(
        ({ date }, index) =>
          date.getTime() < cutoff
          || (this.copies !== null && index >= this.copies),
      )
      .map(({ name }) => name);
  }
}

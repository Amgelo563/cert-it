/** Names of backup archives, which carry the time they were taken so remotes that don't keep file dates can still be pruned. */
export class BackupFileName {
  protected static readonly Pattern =
    /^cert-it-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.zip$/;

  /** Returns the archive name for a backup taken at the given time. */
  public static create(date: Date): string {
    const stamp = date
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z')
      .replaceAll(/[-:]/g, '');

    return `cert-it-${stamp}.zip`;
  }

  /** Returns when a backup was taken, or null if the name isn't a backup archive's. */
  public static parse(name: string): Date | null {
    const match = BackupFileName.Pattern.exec(name);
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match.map(Number) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

    return Number.isNaN(date.getTime()) ? null : date;
  }
}

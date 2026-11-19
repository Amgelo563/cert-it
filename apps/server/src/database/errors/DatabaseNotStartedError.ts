/** An error for using the database before {@link DatabaseService.start} opened it. */
export class DatabaseNotStartedError extends Error {
  constructor() {
    super('The database was used before it was started.');
    this.name = 'DatabaseNotStartedError';
  }
}

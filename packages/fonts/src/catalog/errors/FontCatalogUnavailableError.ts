import { TaggedError } from 'better-result';

/** An error for a catalog that didn't answer in time, answered with an error, or sent something unexpected. */
export class FontCatalogUnavailableError extends TaggedError(
  'FontCatalogUnavailableError',
)<{
  catalog: string;
  /** The HTTP status, if the catalog answered. */
  status: number | null;
  message: string;
  cause?: Error;
}> {
  constructor(args: {
    catalog: string;
    status?: number | null;
    reason: string;
    cause?: Error;
  }) {
    const { reason, ...rest } = args;
    super({
      ...rest,
      status: args.status ?? null,
      message: `The ${args.catalog} font catalog is unavailable: ${reason}.`,
    });
  }
}

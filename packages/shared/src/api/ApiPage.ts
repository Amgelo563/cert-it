/** One page of a paginated list route. */
export type ApiPage<T> = {
  readonly items: readonly T[];
  /** The number of items across all pages. */
  readonly total: number;
  /** The page number, starting at 1. */
  readonly page: number;
  readonly size: number;
};

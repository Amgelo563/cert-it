/** One page of the results of a paginated query. */
export type Page<T> = {
  readonly items: readonly T[];
  /** The number of items across all pages. */
  readonly total: number;
  /** The page number, starting at 1. */
  readonly page: number;
  /** The maximum number of items per page. */
  readonly size: number;
};

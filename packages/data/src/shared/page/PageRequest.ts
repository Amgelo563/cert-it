/** A request for one page of a paginated query. */
export type PageRequest = {
  /** The page number, starting at 1. */
  readonly page: number;
  /** The maximum number of items per page. */
  readonly size: number;
};

import { coerce, object, type output } from 'zod';

// not strict, since pages also carry the lang parameter
export const PageQuerySchema = object({
  page: coerce.number().int().min(1).default(1),
  size: coerce.number().int().min(1).max(100).default(25),
});

/** The query of a paginated list route. */
export type PageQuery = output<typeof PageQuerySchema>;

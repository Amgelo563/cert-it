import { TaggedError } from 'better-result';
import type { CatalogVariant } from '../CatalogVariant';

/** An error for a family, variant or subset that isn't in the catalog. */
export class CatalogFontNotFoundError extends TaggedError(
  'CatalogFontNotFoundError',
)<{
  catalog: string;
  id: string;
  variant: CatalogVariant;
  subset: string | null;
  message: string;
}> {
  constructor(args: {
    catalog: string;
    id: string;
    variant: CatalogVariant;
    subset?: string | null;
  }) {
    const style = `${args.variant.weight}${args.variant.italic ? ' italic' : ''}`;
    const subset = args.subset ? ` (${args.subset})` : '';

    super({
      ...args,
      subset: args.subset ?? null,
      message: `The ${args.catalog} font catalog has no "${args.id}" ${style}${subset}.`,
    });
  }
}

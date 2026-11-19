import { TaggedError } from 'better-result';

/** An error for a model ID that doesn't exist. */
export class ModelNotFoundError extends TaggedError('ModelNotFoundError')<{
  model: string;
  id: unknown;
  message: string;
}> {
  constructor(args: { model: string; id: unknown }) {
    super({
      ...args,
      message: `No ${args.model} found with ID "${String(args.id)}".`,
    });
  }
}

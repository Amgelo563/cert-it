import { TaggedError } from 'better-result';

/** An error thrown when a file's contents don't match its expected schema. */
export class ValidationError extends TaggedError('ValidationError')<{
  path: string;
  error: string;
  message: string;
}> {
  constructor(args: { path: string; error: string }) {
    super({
      ...args,
      message: `Invalid "${args.path}":\n${args.error}`,
    });
  }
}

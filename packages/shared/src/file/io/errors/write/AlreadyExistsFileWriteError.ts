import { TaggedError } from 'better-result';

export class AlreadyExistsFileWriteError extends TaggedError(
  'AlreadyExistsFileWriteError',
)<{
  path: string;
  message: string;
}> {
  constructor(args: { path: string }) {
    super({
      ...args,
      message: `File at path "${args.path}" already exists. Use the force option to overwrite.`,
    });
  }
}

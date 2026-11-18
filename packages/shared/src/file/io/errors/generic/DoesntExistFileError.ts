import { TaggedError } from 'better-result';

export class DoesntExistFileError extends TaggedError('DoesntExistFileError')<{
  path: string;
  message: string;
}> {
  constructor(args: { path: string }) {
    super({
      ...args,
      message: `File at path "${args.path}" doesn't exist or it's not a file.`,
    });
  }
}

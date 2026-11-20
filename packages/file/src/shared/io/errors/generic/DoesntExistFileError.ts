import { TaggedError } from 'better-result';

export class DoesntExistFileError extends TaggedError('DoesntExistFileError')<{
  path: string;
  message: string;
}> {
  // ENOTDIR for a missing parent folder, EISDIR for a folder read as a file
  protected static readonly MissingFileCodes: ReadonlySet<string> = new Set([
    'ENOENT',
    'ENOTDIR',
    'EISDIR',
  ]);

  constructor(args: { path: string }) {
    super({
      ...args,
      message: `File at path "${args.path}" doesn't exist or it's not a file.`,
    });
  }

  /** Returns whether the given error, thrown by a node:fs call, means the path doesn't exist or isn't a file. */
  public static matches(error: unknown): boolean {
    return (
      error instanceof Error
      && 'code' in error
      && typeof error.code === 'string'
      && DoesntExistFileError.MissingFileCodes.has(error.code)
    );
  }
}

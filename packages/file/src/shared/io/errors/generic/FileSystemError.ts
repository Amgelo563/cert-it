import { TaggedError } from 'better-result';

export class FileSystemError extends TaggedError('FileSystemError')<{
  path: string;
  message: string;
  cause: Error;
}> {
  constructor(args: { path: string; message: string; cause: Error }) {
    super({
      ...args,
      message: `Unknown file system error with file "${args.path}": ${args.message}`,
    });
  }
}

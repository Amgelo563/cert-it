import { TaggedError } from 'better-result';

export class SyntaxFileReadError extends TaggedError('SyntaxFileReadError')<{
  path: string;
  format: string;
  message: string;
}> {
  constructor(args: { path: string; format: string; message: string }) {
    super({
      ...args,
      message: `${args.format} syntax error while reading "${args.path}": ${args.message}`,
    });
  }
}

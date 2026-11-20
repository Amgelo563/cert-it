import { TaggedError } from 'better-result';

export class SerializationFileWriteError extends TaggedError(
  'SerializationFileWriteError',
)<{
  input: unknown;
  format: string;
  message: string;
  cause?: Error;
}> {
  constructor(args: { input: unknown; format: string; cause?: Error }) {
    super({
      ...args,
      message: `The input "${String(args.input)}" couldn't be serialized to format "${args.format}".`,
    });
  }
}

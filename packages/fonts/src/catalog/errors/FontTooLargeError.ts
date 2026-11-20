import { TaggedError } from 'better-result';

/** An error for a font file larger than the allowed size. */
export class FontTooLargeError extends TaggedError('FontTooLargeError')<{
  maxBytes: number;
  message: string;
}> {
  constructor(args: { maxBytes: number }) {
    super({
      ...args,
      message: `The font file is larger than ${args.maxBytes} bytes.`,
    });
  }
}

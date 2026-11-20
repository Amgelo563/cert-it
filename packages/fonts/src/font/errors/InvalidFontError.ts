import { TaggedError } from 'better-result';
import {
  type InvalidFontReason,
  InvalidFontReasonEnum,
} from '../InvalidFontReasonEnum';

/** An error for a file that can't be used as a font. */
export class InvalidFontError extends TaggedError('InvalidFontError')<{
  reason: InvalidFontReason;
  message: string;
  cause?: Error;
}> {
  protected static readonly Messages: Record<InvalidFontReason, string> = {
    [InvalidFontReasonEnum.Unreadable]: 'The file is broken or is not a font.',
    [InvalidFontReasonEnum.Collection]:
      'The file holds several fonts. Use a single TTF or OTF font.',
    [InvalidFontReasonEnum.WebFormat]:
      'The file is a web font (WOFF or WOFF2). Use the TTF or OTF version.',
  };

  constructor(args: { reason: InvalidFontReason; cause?: Error }) {
    super({ ...args, message: InvalidFontError.Messages[args.reason] });
  }
}

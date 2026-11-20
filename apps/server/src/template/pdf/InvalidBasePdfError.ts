import { TaggedError } from 'better-result';
import { type BasePdfProblem, BasePdfProblemEnum } from './BasePdfProblemEnum';

/** An error for a file that can't be used as a base PDF. */
export class InvalidBasePdfError extends TaggedError('InvalidBasePdfError')<{
  problem: BasePdfProblem;
  message: string;
}> {
  protected static readonly Messages: Record<BasePdfProblem, string> = {
    [BasePdfProblemEnum.Invalid]: 'The file is broken or is not a PDF.',
    [BasePdfProblemEnum.Encrypted]: 'The PDF is encrypted.',
    [BasePdfProblemEnum.NotOnePage]: 'The PDF must have exactly one page.',
  };

  constructor(args: { problem: BasePdfProblem }) {
    super({ ...args, message: InvalidBasePdfError.Messages[args.problem] });
  }
}

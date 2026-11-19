import { TaggedError } from 'better-result';

/** An error for a write that would repeat a value that must be unique. */
export class DuplicateModelError extends TaggedError('DuplicateModelError')<{
  model: string;
  fields: readonly string[];
  message: string;
}> {
  constructor(args: { model: string; fields: readonly string[] }) {
    super({
      ...args,
      message: `Duplicate ${args.model} on ${args.fields.join(', ')}.`,
    });
  }

  /** Returns whether the violated constraint covers exactly the given fields, in any order. */
  public isOn(...fields: string[]): boolean {
    return (
      fields.length === this.fields.length
      && fields.every((field) => this.fields.includes(field))
    );
  }
}

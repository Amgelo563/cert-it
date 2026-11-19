import { type output, prettifyError, type ZodType } from 'zod';
import type { Validator } from '../../shared/validation/Validator';
import { Result } from 'better-result';

export class ZodValidator<Schema extends ZodType> implements Validator<
  output<Schema>
> {
  protected readonly schema: Schema;

  constructor(schema: Schema) {
    this.schema = schema;
  }

  public validate(input: unknown): Result<output<Schema>, string> {
    const result = this.schema.safeParse(input);
    if (result.success) {
      return Result.ok(result.data);
    }
    return Result.err(prettifyError(result.error));
  }
}

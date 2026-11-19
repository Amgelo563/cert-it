import { Result } from 'better-result';
import type { FileReadError, FileWriteError } from '../io/errors/IOError.js';
import type { FileIO } from '../io/FileIO.js';
import { ValidationError } from '../validation/errors/ValidationError.js';
import type { Validator } from '../validation/Validator.js';

/** An object that reads a file at a given path and validates it matches a given schema. */
export class FileProcessor<SchemaOutput> {
  protected readonly io: FileIO;

  protected readonly validator: Validator<SchemaOutput>;

  protected readonly path: string;

  protected cache: SchemaOutput | null = null;

  constructor(options: {
    io: FileIO;
    validator: Validator<SchemaOutput>;
    path: string;
  }) {
    this.io = options.io;
    this.validator = options.validator;
    this.path = options.path;
  }

  /** Reads and validates the file, or returns the last valid read unless `force` is set. */
  public async read(options?: {
    force?: boolean;
  }): Promise<Result<SchemaOutput, FileReadError | ValidationError>> {
    if (!options?.force && this.cache !== null) {
      return Result.ok(this.cache);
    }

    const result = await this.io.read(this.path);
    if (result.isErr()) {
      return Result.err(result.error);
    }

    const validated = this.validator
      .validate(result.value)
      .mapError((error) => new ValidationError({ path: this.path, error }));

    if (validated.isOk()) {
      this.cache = validated.value;
    }

    return validated;
  }

  /** Writes the given data to the file, and caches it on success. */
  public async write(options: {
    data: SchemaOutput;
    force?: boolean;
  }): Promise<Result<void, FileWriteError>> {
    const { data, force = false } = options;
    const result = await this.io.write({
      data,
      path: this.path,
      overwriteIfPresent: force,
    });

    if (result.isOk()) {
      this.cache = data;
    }

    return result;
  }

  public getPath(): string {
    return this.path;
  }
}

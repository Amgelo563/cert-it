import { Result } from 'better-result';
import {
  AlreadyExistsFileWriteError,
  DoesntExistFileError,
  type FileReadError,
  FileSystemError,
  type FileWriteError,
  SerializationFileWriteError,
  SyntaxFileReadError,
} from '@cert-it/shared';
import type { FileIO } from '../../shared/io/FileIO';
import { parse, stringify } from 'yaml';
import { readFile, writeFile } from 'node:fs/promises';

export class YamlIO implements FileIO {
  public static readonly Extension = '.yml';

  public static readonly Instance = new YamlIO();

  public static readonly CamelizedInstance = new YamlIO({ camelizeKeys: true });

  protected readonly camelizeKeys: boolean;

  constructor(options: { camelizeKeys?: boolean } = {}) {
    this.camelizeKeys = options.camelizeKeys ?? false;
  }

  public static buildName(file: string): string {
    return file.endsWith(YamlIO.Extension)
      ? file
      : `${file}${YamlIO.Extension}`;
  }

  /** Recursively turns `snake_case` object keys into `camelCase`. */
  protected static camelizeKeys(this: void, value: unknown): unknown {
    return YamlIO.mapKeys(value, (key) =>
      key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase()),
    );
  }

  /** Recursively turns `camelCase` object keys into `snake_case`, so a camelized read writes back the same keys. */
  protected static snakifyKeys(this: void, value: unknown): unknown {
    return YamlIO.mapKeys(value, (key) =>
      key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`),
    );
  }

  protected static mapKeys(
    value: unknown,
    map: (key: string) => string,
  ): unknown {
    if (Array.isArray(value)) {
      return value.map((inner: unknown) => YamlIO.mapKeys(inner, map));
    }
    if (value === null || typeof value !== 'object') return value;

    // dates and other class instances are values, not key maps
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;

    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        map(key),
        YamlIO.mapKeys(inner, map),
      ]),
    );
  }

  public async read(path: string): Promise<Result<unknown, FileReadError>> {
    const fullPath = YamlIO.buildName(path);

    let read;
    try {
      read = await readFile(fullPath, { encoding: 'utf-8' });
    } catch (e) {
      if (DoesntExistFileError.matches(e)) {
        return Result.err(new DoesntExistFileError({ path: fullPath }));
      }

      const error = e as Error;
      return Result.err(
        new FileSystemError({
          path: fullPath,
          message: error.message,
          cause: error,
        }),
      );
    }

    let parsed;
    try {
      parsed = await parse(read);
    } catch (e) {
      return Result.err(
        new SyntaxFileReadError({
          path: fullPath,
          message: (e as Error).message,
          format: 'YAML',
        }),
      );
    }

    return Result.ok(this.camelizeKeys ? YamlIO.camelizeKeys(parsed) : parsed);
  }

  public async write(options: {
    data: unknown;
    path: string;
    overwriteIfPresent?: boolean;
  }): Promise<Result<void, FileWriteError>> {
    const { data, overwriteIfPresent = false } = options;
    const path = YamlIO.buildName(options.path);

    let serialized: string;
    try {
      serialized = stringify(
        this.camelizeKeys ? YamlIO.snakifyKeys(data) : data,
      );
    } catch (e) {
      return Result.err(
        new SerializationFileWriteError({
          input: data,
          format: 'YAML',
          cause: e as Error,
        }),
      );
    }

    try {
      // wx checks and creates in one step, so a file created meanwhile isn't overwritten
      await writeFile(path, serialized, {
        flag: overwriteIfPresent ? 'w' : 'wx',
      });
    } catch (e) {
      const error = e as NodeJS.ErrnoException;
      if (error.code === 'EEXIST') {
        return Result.err(new AlreadyExistsFileWriteError({ path }));
      }

      return Result.err(
        new FileSystemError({ path, message: error.message, cause: error }),
      );
    }

    return Result.ok(undefined);
  }
}

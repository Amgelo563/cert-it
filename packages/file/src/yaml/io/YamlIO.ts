import { Result } from 'better-result';
import { DoesntExistFileError } from '../../shared/io/errors/generic/DoesntExistFileError';
import { FileSystemError } from '../../shared/io/errors/generic/FileSystemError';
import type {
  FileReadError,
  FileWriteError,
} from '../../shared/io/errors/IOError';
import { SyntaxFileReadError } from '../../shared/io/errors/read/SyntaxFileReadError';
import { SerializationFileWriteError } from '../../shared/io/errors/write/SerializationFileWriteError';
import type { FileIO } from '../../shared/io/FileIO';
import { existsSync, statSync } from 'node:fs';
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
    if (Array.isArray(value)) return value.map(YamlIO.camelizeKeys);
    if (value === null || typeof value !== 'object') return value;

    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase()),
        YamlIO.camelizeKeys(inner),
      ]),
    );
  }

  public async read(path: string): Promise<Result<unknown, FileReadError>> {
    const fullPath = YamlIO.buildName(path);
    if (!existsSync(fullPath)) {
      return Result.err(new DoesntExistFileError({ path: fullPath }));
    }

    const stat = statSync(fullPath);
    if (!stat || !stat.isFile()) {
      return Result.err(new DoesntExistFileError({ path: fullPath }));
    }

    let read;
    try {
      read = await readFile(fullPath, { encoding: 'utf-8' });
    } catch (e) {
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
    const { data, path } = options;
    let serialized: string;
    try {
      serialized = stringify(data);
    } catch (_e) {
      return Result.err(
        new SerializationFileWriteError({
          input: data,
          format: 'YAML',
          cause: _e as Error,
        }),
      );
    }

    try {
      await writeFile(path, serialized);
    } catch (e) {
      const error = e as Error;
      return Result.err(
        new FileSystemError({ path, message: error.message, cause: error }),
      );
    }

    return Result.ok(undefined);
  }
}

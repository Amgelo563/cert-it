# @cert-it/file

Project-agnostic API to read, validate, cache and write files, with YAML and Zod implementations.

- `shared/`: format-agnostic contracts (`FileIO`, `Validator`, `FileProcessor`) and `ValidationError`.
- `yaml/`: `YamlIO`, a `FileIO` for `.yml` files, optionally turning `snake_case` keys into `camelCase`.
- `zod/`: `ZodValidator`, and the `ZodYamlFileProcessor` util.

`yaml` and `zod` are peer dependencies, so the app picks their versions. The read and write errors come from
`@cert-it/shared`, so packages that only need the errors don't load `yaml` or `zod`.

## Usage

### 1. Processor

A `FileProcessor` handles one file. It's built from a `FileIO` that reads and writes the format, a `Validator` that checks
the contents, and the file's path.

```ts
import { FileProcessor, YamlIO, ZodValidator } from '@cert-it/file';
import { boolean, int, strictObject, string } from 'zod';

const SettingsSchema = strictObject({
  name: string(),
  port: int().positive(),
  debug: boolean().default(false),
});

const settings = new FileProcessor({
  io: YamlIO.Instance,
  validator: new ZodValidator({ schema: SettingsSchema }),
  path: YamlIO.buildName('settings'), // settings.yml
});
```

`YamlIO.CamelizedInstance` reads `snake_case` keys as `camelCase`, so a `max_items` in the file reaches the schema as
`maxItems`.

#### `ZodYamlFileProcessor`

`ZodYamlFileProcessor` is a util for a YAML + Zod pair. It adds no behavior of its own, so the processor
above can also be written as:

```ts
import { ZodYamlFileProcessor } from '@cert-it/file';

const settings = new ZodYamlFileProcessor({
  schema: SettingsSchema,
  path: 'settings',
  camelizeKeys: false, // uses YamlIO.CamelizedInstance when true
});
```

To give a file a single shared instance, extend it:

```ts
export class SettingsFileProcessor extends ZodYamlFileProcessor<
  typeof SettingsSchema
> {
  public static readonly Instance = new SettingsFileProcessor();

  protected constructor() {
    super({ schema: SettingsSchema, path: 'settings' });
  }
}
```

### 2. Reading and writing

`read` validates the file and caches the result, so later reads don't touch the disk unless `force` is set. A successful
`write` also updates the cache.

```ts
const result = await settings.read();
if (result.isErr()) {
  console.error(result.error.message);
  process.exit(1);
}

const { name, port } = result.value;

// reread after the file changed
const fresh = await settings.read({ force: true });

await settings.write({ data: { ...result.value, debug: true } });
```

### 3. Other formats or validators

Since `FileProcessor` takes any `FileIO` and `Validator`, a new format or validation library only needs that one piece.

```ts
import { type FileIO, FileProcessor, type Validator } from '@cert-it/file';
import type { FileReadError, FileWriteError } from '@cert-it/shared';
import type { Result } from 'better-result';

/** A `FileIO` for JSON files. */
export class JsonIO implements FileIO {
  public async read(path: string): Promise<Result<unknown, FileReadError>> {
    // ...
  }

  public async write(options: {
    data: unknown;
    path: string;
    overwriteIfPresent?: boolean;
  }): Promise<Result<void, FileWriteError>> {
    // ...
  }
}

/** A `Validator` backed by another validation library. */
export class OtherValidator<T> implements Validator<T> {
  public validate(data: unknown): Result<T, string> {
    // ...
  }
}

const state = new FileProcessor({
  io: new JsonIO(),
  validator: new OtherValidator<State>(),
  path: 'data/state.json',
});
```

A `Validator` returns the parsed value, or a readable message that the processor wraps in a `ValidationError`.

### 4. Handling errors

Every error is a `TaggedError`, any other error is thrown. `ValidationError` comes from `@cert-it/file`, the rest from
`@cert-it/shared`.

- Reading: `DoesntExistFileError`, `SyntaxFileReadError`, `FileSystemError` (`FileReadError`), plus `ValidationError` from a processor.
- Writing: `AlreadyExistsFileWriteError`, `SerializationFileWriteError`, `FileSystemError` (`FileWriteError`).

```ts
result.error.match({
  DoesntExistFileError: (error) => console.error(`Create ${error.path}`),
  SyntaxFileReadError: (error) => console.error(error.message),
  ValidationError: (error) => console.error(error.message),
  FileSystemError: (error) => {
    throw error.cause;
  },
});
```

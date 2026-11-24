import { ZodYamlFileProcessor } from '@cert-it/file';
import { type Config, ConfigSchema } from '../schema/ConfigSchema';

type ConfigServiceOptions = {
  /** Path of the config file, without its extension. */
  path: string;
};

/** Reads config.yml and validates it against the config schema. */
export class ConfigService extends ZodYamlFileProcessor<typeof ConfigSchema> {
  protected static readonly DefaultPath = 'config/config';

  constructor(options: ConfigServiceOptions) {
    super({ schema: ConfigSchema, path: options.path, camelizeKeys: true });
  }

  public static create(options?: {
    injections?: Partial<ConfigServiceOptions>;
  }): ConfigService {
    return new ConfigService({
      path: options?.injections?.path ?? ConfigService.DefaultPath,
    });
  }

  /** Reads and validates the config file, or prints what's wrong with it and exits the process. */
  public async readOrExit(): Promise<Config> {
    const result = await this.read();

    return result.match({
      ok: (config) => config,
      err: (error) => {
        console.error(error.message);
        process.exit(1);
      },
    });
  }
}

import { ZodYamlFileProcessor } from '@cert-it/file';
import { type Config, ConfigSchema } from '../schema/ConfigSchema';

export class ConfigService extends ZodYamlFileProcessor<typeof ConfigSchema> {
  protected constructor() {
    super({ schema: ConfigSchema, path: 'config/config', camelizeKeys: true });
  }

  public static create(): ConfigService {
    return new ConfigService();
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

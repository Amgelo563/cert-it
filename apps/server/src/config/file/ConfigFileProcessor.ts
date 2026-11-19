import { ZodYamlFileProcessor } from '@cert-it/file';
import { ConfigSchema } from '../schema/ConfigSchema';

export class ConfigFileProcessor extends ZodYamlFileProcessor<
  typeof ConfigSchema
> {
  public static readonly Instance = new ConfigFileProcessor();

  protected constructor() {
    super({ schema: ConfigSchema, path: 'config/config', camelizeKeys: true });
  }
}

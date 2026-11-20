import {
  type Config,
  ConfigSchema,
} from '../../../src/config/schema/ConfigSchema';

/** Returns a valid config with defaults, for services that read a few of its values. */
export function createTestConfig(): Config {
  return ConfigSchema.parse({
    site: { baseUrl: 'https://example.org/certs', orgName: 'Example' },
    admin: { email: 'admin@example.org' },
  });
}

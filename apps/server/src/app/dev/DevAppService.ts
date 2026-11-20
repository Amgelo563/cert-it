import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Role, RoleEnum } from '@cert-it/shared';
import { type Config, ConfigSchema } from '../../config/schema/ConfigSchema';
import { DatabaseService } from '../../database/DatabaseService';
import { normalizeEmail } from '../../util/email/NormalizedEmail';
import { AppService, type AppServiceInjections } from '../AppService';

type DevUser = {
  email: string;
  role: Role;
  mustChangePassword: boolean;
};

/** The server for local development: no config file, an in-memory database with known users, and files in a temporary folder removed on stop. */
export class DevAppService extends AppService {
  /** Password of every dev user. */
  public static readonly Password = 'cert-it-dev';

  // what pnpm dev would otherwise read from config.yml
  protected static readonly DevConfig = {
    site: { baseUrl: 'http://localhost:3000', orgName: 'cert-it (dev)' },
    admin: { email: 'admin@cert-it.test' },
  };

  // one per role, plus one that has to change the password first
  protected static readonly Users: readonly DevUser[] = [
    {
      email: 'admin@cert-it.test',
      role: RoleEnum.Admin,
      mustChangePassword: false,
    },
    {
      email: 'editor@cert-it.test',
      role: RoleEnum.Editor,
      mustChangePassword: false,
    },
    {
      email: 'viewer@cert-it.test',
      role: RoleEnum.Viewer,
      mustChangePassword: false,
    },
    {
      email: 'new@cert-it.test',
      role: RoleEnum.Viewer,
      mustChangePassword: true,
    },
  ];

  public static override create(options?: {
    config?: Config;
    injections?: AppServiceInjections;
  }): DevAppService {
    const config =
      options?.config
      ?? ConfigSchema.parse({
        ...DevAppService.DevConfig,
        server: {
          dataDir: join(tmpdir(), `cert-it-dev-${process.pid}`),
        },
      });

    return new DevAppService(
      AppService.createServices({
        config,
        injections: {
          database: new DatabaseService({ path: ':memory:' }),
          ...options?.injections,
        },
      }),
    );
  }

  /** Stops the server and removes its temporary files. */
  public override async stop(): Promise<void> {
    await super.stop();
    await rm(this.dataDirectory.getRoot(), { recursive: true, force: true });
  }

  // known users instead of the first Admin with a random password
  protected override async startUsers(): Promise<void> {
    const { users } = this.database.getRepositories();
    const passwordHash = await this.passwords.hash(DevAppService.Password);

    for (const user of DevAppService.Users) {
      users
        .create({ ...user, email: normalizeEmail(user.email), passwordHash })
        .unwrap();
    }

    console.log(
      [
        `Dev users, all with the password ${DevAppService.Password}:`,
        ...DevAppService.Users.map(
          ({ email, role, mustChangePassword }) =>
            `  ${email} (${role}${mustChangePassword ? ', must change password' : ''})`,
        ),
      ].join('\n'),
    );
  }

  // the admin dev server serves the panel, with hot reload
  protected override startAdminPanel(): Promise<void> {
    return Promise.resolve();
  }
}

import { RoleEnum } from '@cert-it/shared';
import type { PasswordHasher } from '../auth/password/PasswordHasher';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { normalizeEmail } from '../util/email/NormalizedEmail';

type UserServiceOptions = {
  database: DatabaseService;
  passwords: PasswordHasher;
  /** Email of the first Admin, as in admin.email. */
  firstAdminEmail: string;
  /** @default console.log */
  log?: (line: string) => void;
};

/** Manages admin panel users, starting with the first Admin. */
export class UserService {
  protected readonly database: DatabaseService;

  protected readonly passwords: PasswordHasher;

  protected readonly firstAdminEmail: string;

  protected readonly log: (line: string) => void;

  constructor(options: UserServiceOptions) {
    this.database = options.database;
    this.passwords = options.passwords;
    this.firstAdminEmail = options.firstAdminEmail;
    this.log = options.log ?? console.log;
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    passwords: PasswordHasher;
    injections?: Partial<UserServiceOptions>;
  }): UserService {
    const { config, database, passwords, injections } = options;

    return new UserService({
      database: injections?.database ?? database,
      passwords: injections?.passwords ?? passwords,
      firstAdminEmail: injections?.firstAdminEmail ?? config.admin.email,
      log: injections?.log,
    });
  }

  /** Creates the first Admin when there are no users, printing its random password once. */
  public async start(): Promise<void> {
    const { users } = this.database.getRepositories();
    if (users.count() > 0) return;

    const password = this.passwords.generate();
    const passwordHash = await this.passwords.hash(password);
    const admin = users
      .create({
        email: normalizeEmail(this.firstAdminEmail),
        passwordHash,
        role: RoleEnum.Admin,
        mustChangePassword: true,
      })
      .unwrap();

    this.log(
      `Created the first Admin, ${admin.email}, with the password ${password} (to change at first login)`,
    );
  }
}

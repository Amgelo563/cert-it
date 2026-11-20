import {
  AbstractSqliteRepository,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import { RoleEnum } from '@cert-it/shared';
import { and, eq } from 'drizzle-orm';
import type { NormalizedEmail } from '../../util/email/NormalizedEmail';
import type { User, UserId } from '../User';
import { userTable } from './userTable';
import type { UserRepository } from './UserRepository';

export class SqliteUserRepository
  extends AbstractSqliteRepository<User, typeof userTable>
  implements UserRepository
{
  protected readonly table = userTable;

  public findByEmail(email: NormalizedEmail): User | null {
    return this.findOne({ where: eq(userTable.email, email) });
  }

  public findPasswordHash(id: UserId): string | null {
    const row = this.db
      .select({ passwordHash: userTable.passwordHash })
      .from(userTable)
      .where(eq(userTable.id, id))
      .get();

    return row?.passwordHash ?? null;
  }

  public list(page: PageRequest): Page<User> {
    return this.findPage(page, { orderBy: [userTable.email] });
  }

  public override count(): number {
    return super.count();
  }

  public countActiveAdmins(): number {
    return super.count(
      and(eq(userTable.role, RoleEnum.Admin), eq(userTable.active, true)),
    );
  }

  // the password hash is left out, and only read through findPasswordHash
  protected toModel(row: typeof userTable.$inferSelect): User {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      active: row.active,
      mustChangePassword: row.mustChangePassword,
      createdAt: row.createdAt,
    };
  }
}

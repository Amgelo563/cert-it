import {
  AbstractSqliteRepository,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import { RoleEnum } from '@cert-it/shared';
import { and, count, eq } from 'drizzle-orm';
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
    const row = this.db
      .select()
      .from(userTable)
      .where(eq(userTable.email, email))
      .get();

    return row ? this.toModel(row) : null;
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

  public count(): number {
    return this.db.select({ total: count() }).from(userTable).get()?.total ?? 0;
  }

  public countActiveAdmins(): number {
    const row = this.db
      .select({ total: count() })
      .from(userTable)
      .where(
        and(eq(userTable.role, RoleEnum.Admin), eq(userTable.active, true)),
      )
      .get();

    return row?.total ?? 0;
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

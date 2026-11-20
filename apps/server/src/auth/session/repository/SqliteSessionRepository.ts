import { AbstractSqliteRepository } from '@cert-it/data';
import { eq, lte } from 'drizzle-orm';
import type { UserId } from '../../../user/User';
import type { Session } from '../Session';
import { sessionTable } from './sessionTable';
import type { SessionRepository } from './SessionRepository';

export class SqliteSessionRepository
  extends AbstractSqliteRepository<Session, typeof sessionTable>
  implements SessionRepository
{
  protected readonly table = sessionTable;

  public findByTokenHash(tokenHash: string): Session | null {
    return this.findOne({ where: eq(sessionTable.tokenHash, tokenHash) });
  }

  public deleteByUser(userId: UserId): number {
    return this.db
      .delete(sessionTable)
      .where(eq(sessionTable.userId, userId))
      .run().changes;
  }

  public deleteExpired(now: Date): number {
    return this.db
      .delete(sessionTable)
      .where(lte(sessionTable.expiresAt, now))
      .run().changes;
  }

  protected toModel(row: typeof sessionTable.$inferSelect): Session {
    return row;
  }
}

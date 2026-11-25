import type { SqliteExecutor } from '@cert-it/data';
import type { OnboardingStep } from '@cert-it/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { UserId } from '../../user/User';
import { userTable } from '../../user/repository/userTable';
import type { OnboardingRepository } from './OnboardingRepository';
import { onboardingStepTable } from './onboardingStepTable';

type SqliteOnboardingRepositoryOptions = { db: SqliteExecutor };

export class SqliteOnboardingRepository implements OnboardingRepository {
  protected readonly db: SqliteExecutor;

  constructor(options: SqliteOnboardingRepositoryOptions) {
    this.db = options.db;
  }

  public findCompletedSteps(userId: UserId): OnboardingStep[] {
    return this.db
      .select({ step: onboardingStepTable.step })
      .from(onboardingStepTable)
      .where(eq(onboardingStepTable.userId, userId))
      .all()
      .map((row) => row.step);
  }

  public isDismissed(userId: UserId): boolean {
    const row = this.db
      .select({ dismissedAt: userTable.onboardingDismissedAt })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .get();

    return Boolean(row?.dismissedAt);
  }

  public completeStep(userId: UserId, step: OnboardingStep): void {
    this.db
      .insert(onboardingStepTable)
      .values({ userId, step })
      .onConflictDoNothing()
      .run();
  }

  public dismiss(userId: UserId): void {
    this.db
      .update(userTable)
      .set({ onboardingDismissedAt: new Date() })
      .where(
        and(eq(userTable.id, userId), isNull(userTable.onboardingDismissedAt)),
      )
      .run();
  }
}

import type { OnboardingStep } from '@cert-it/shared';
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import type { UserId } from '../../user/User';
import { userTable } from '../../user/repository/userTable';

export const onboardingStepTable = sqliteTable(
  'onboarding_steps',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => userTable.id, { onDelete: 'cascade' })
      .$type<UserId>(),
    step: text('step').notNull().$type<OnboardingStep>(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.userId, table.step] })],
);

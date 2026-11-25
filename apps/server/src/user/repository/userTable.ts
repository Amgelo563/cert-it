import type { Role } from '@cert-it/shared';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { NormalizedEmail } from '../../util/email/NormalizedEmail';
import type { UserId } from '../User';

export const userTable = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }).$type<UserId>(),
  email: text('email').notNull().unique().$type<NormalizedEmail>(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().$type<Role>(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' })
    .notNull()
    .default(true),
  /** When the user stopped the getting started guide from opening on its own. */
  onboardingDismissedAt: integer('onboarding_dismissed_at', {
    mode: 'timestamp_ms',
  }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

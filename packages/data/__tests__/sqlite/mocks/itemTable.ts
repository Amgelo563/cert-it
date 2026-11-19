import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import type { ItemId } from './Item';

export const itemTable = sqliteTable(
  'items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }).$type<ItemId>(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    groupId: integer('group_id').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [unique().on(table.groupId, table.position)],
);

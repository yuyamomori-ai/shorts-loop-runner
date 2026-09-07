import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', { owner: text('owner').primaryKey(), data: text('data').notNull(), schemaVersion: integer('schema_version').notNull().default(2), revision: integer('revision').notNull().default(0), updatedAt: text('updated_at').notNull() });

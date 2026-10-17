import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const horizonRooms = sqliteTable("horizon_rooms", {
  code: text("code").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const horizonAccounts = sqliteTable("horizon_accounts", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const horizonAccountsV2 = sqliteTable("horizon_accounts_v2", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

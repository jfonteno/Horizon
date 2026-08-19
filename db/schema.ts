import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const horizonRooms = sqliteTable("horizon_rooms", {
  code: text("code").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: text("updated_at").notNull(),
});

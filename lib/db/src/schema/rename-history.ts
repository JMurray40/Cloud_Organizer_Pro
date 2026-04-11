import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { filesTable } from "./files";

export const renameHistoryTable = pgTable("rename_history", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").references(() => filesTable.id, { onDelete: "set null" }),
  fileOriginalName: text("file_original_name").notNull(),
  action: text("action").notNull(),
  oldName: text("old_name"),
  newName: text("new_name"),
  oldStatus: text("old_status"),
  newStatus: text("new_status"),
  notes: text("notes"),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RenameHistory = typeof renameHistoryTable.$inferSelect;

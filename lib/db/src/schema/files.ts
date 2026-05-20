import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const filesTable = pgTable(
  "files",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    originalName: text("original_name").notNull(),
    suggestedName: text("suggested_name").notNull(),
    currentName: text("current_name").notNull(),
    category: text("category").notNull(),
    subCategory: text("sub_category"),
    suggestedPath: text("suggested_path").notNull(),
    currentPath: text("current_path"),
    cloudAccountId: integer("cloud_account_id"),
    status: text("status").notNull().default("pending"),
    fileSize: integer("file_size"),
    fileExtension: text("file_extension").notNull().default(""),
    notes: text("notes"),
    isDuplicate: boolean("is_duplicate").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("files_user_idx").on(t.userId),
    index("files_user_status_idx").on(t.userId, t.status),
    index("files_user_category_idx").on(t.userId, t.category),
    index("files_user_cloud_idx").on(t.userId, t.cloudAccountId),
    index("files_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

export const insertFileSchema = createInsertSchema(filesTable).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type InsertFile = z.infer<typeof insertFileSchema>;
export type FileRecord = typeof filesTable.$inferSelect;

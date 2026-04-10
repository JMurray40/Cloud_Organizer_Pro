import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cloudAccountsTable = pgTable("cloud_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  accountLabel: text("account_label").notNull(),
  rootPath: text("root_path"),
  isActive: boolean("is_active").notNull().default(true),
  fileCount: integer("file_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCloudAccountSchema = createInsertSchema(cloudAccountsTable).omit({ id: true, createdAt: true });
export type InsertCloudAccount = z.infer<typeof insertCloudAccountSchema>;
export type CloudAccount = typeof cloudAccountsTable.$inferSelect;

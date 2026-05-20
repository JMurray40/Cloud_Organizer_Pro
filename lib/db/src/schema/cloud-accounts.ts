import { pgTable, text, serial, timestamp, boolean, integer, doublePrecision, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cloudAccountsTable = pgTable(
  "cloud_accounts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    accountLabel: text("account_label").notNull(),
    rootPath: text("root_path"),
    isActive: boolean("is_active").notNull().default(true),
    fileCount: integer("file_count").notNull().default(0),
    quotaTotalGb: doublePrecision("quota_total_gb"),
    quotaUsedGb: doublePrecision("quota_used_gb"),
    connectedViaOAuth: boolean("connected_via_oauth").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cloud_accounts_user_idx").on(t.userId)],
);

export const insertCloudAccountSchema = createInsertSchema(cloudAccountsTable).omit({ id: true, userId: true, createdAt: true });
export type InsertCloudAccount = z.infer<typeof insertCloudAccountSchema>;
export type CloudAccount = typeof cloudAccountsTable.$inferSelect;

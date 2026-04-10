import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const namingRulesTable = pgTable("naming_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  pattern: text("pattern").notNull(),
  folderPath: text("folder_path").notNull(),
  extensions: text("extensions").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNamingRuleSchema = createInsertSchema(namingRulesTable).omit({ id: true, createdAt: true });
export type InsertNamingRule = z.infer<typeof insertNamingRuleSchema>;
export type NamingRule = typeof namingRulesTable.$inferSelect;

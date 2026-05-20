import { pgTable, serial, integer, date } from "drizzle-orm/pg-core";

export const orgScoreSnapshotsTable = pgTable("org_score_snapshots", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  score: integer("score").notNull(),
  totalFiles: integer("total_files").notNull(),
  organizedFiles: integer("organized_files").notNull(),
  renamedFiles: integer("renamed_files").notNull().default(0),
});

export type OrgScoreSnapshot = typeof orgScoreSnapshotsTable.$inferSelect;

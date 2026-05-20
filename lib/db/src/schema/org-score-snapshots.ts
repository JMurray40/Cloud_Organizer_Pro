import { pgTable, serial, integer, date, text, uniqueIndex, index } from "drizzle-orm/pg-core";

export const orgScoreSnapshotsTable = pgTable(
  "org_score_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: date("date").notNull(),
    score: integer("score").notNull(),
    totalFiles: integer("total_files").notNull(),
    organizedFiles: integer("organized_files").notNull(),
    renamedFiles: integer("renamed_files").notNull().default(0),
  },
  (t) => [
    uniqueIndex("org_score_user_date_uq").on(t.userId, t.date),
    index("org_score_user_idx").on(t.userId),
  ],
);

export type OrgScoreSnapshot = typeof orgScoreSnapshotsTable.$inferSelect;

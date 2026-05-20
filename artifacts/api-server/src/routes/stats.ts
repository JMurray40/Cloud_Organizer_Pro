import { Router, type IRouter } from "express";
import { db, filesTable, cloudAccountsTable, namingRulesTable, orgScoreSnapshotsTable } from "@workspace/db";
import { and, eq, sql, desc, gte } from "drizzle-orm";
import { getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/stats/dashboard", async (req, res): Promise<void> => {
  const userId = getUserId(req);

  const [filesStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      organized: sql<number>`count(*) filter (where status = 'organized')::int`,
      renamed: sql<number>`count(*) filter (where status = 'renamed')::int`,
      duplicates: sql<number>`count(*) filter (where is_duplicate = true)::int`,
    })
    .from(filesTable)
    .where(eq(filesTable.userId, userId));

  const [accountsStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cloudAccountsTable)
    .where(and(eq(cloudAccountsTable.userId, userId), eq(cloudAccountsTable.isActive, true)));

  const [rulesStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(namingRulesTable)
    .where(and(eq(namingRulesTable.userId, userId), eq(namingRulesTable.isActive, true)));

  const fileTypeRows = await db
    .select({
      ext: filesTable.fileExtension,
      count: sql<number>`count(*)::int`,
    })
    .from(filesTable)
    .where(eq(filesTable.userId, userId))
    .groupBy(filesTable.fileExtension)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  const [sizeSavings] = await db
    .select({
      totalDupBytes: sql<number>`coalesce(sum(file_size) filter (where is_duplicate = true), 0)::bigint`,
    })
    .from(filesTable)
    .where(eq(filesTable.userId, userId));

  res.json({
    totalFiles: filesStats?.total ?? 0,
    pendingFiles: filesStats?.pending ?? 0,
    organizedFiles: filesStats?.organized ?? 0,
    renamedFiles: filesStats?.renamed ?? 0,
    duplicatesFound: filesStats?.duplicates ?? 0,
    cloudAccounts: accountsStats?.count ?? 0,
    activeRules: rulesStats?.count ?? 0,
    fileTypeBreakdown: fileTypeRows.map((r) => ({ ext: r.ext, count: r.count })),
    duplicateSavingsBytes: Number(sizeSavings?.totalDupBytes ?? 0),
  });
});

router.get("/stats/category-breakdown", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const breakdown = await db
    .select({
      category: filesTable.category,
      count: sql<number>`count(*)::int`,
    })
    .from(filesTable)
    .where(eq(filesTable.userId, userId))
    .groupBy(filesTable.category)
    .orderBy(sql`count(*) desc`);

  res.json(breakdown);
});

router.get("/stats/recent-activity", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const recent = await db
    .select()
    .from(filesTable)
    .where(eq(filesTable.userId, userId))
    .orderBy(desc(filesTable.updatedAt))
    .limit(10);

  res.json(recent);
});

router.get("/stats/org-trend", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

  const snapshots = await db
    .select()
    .from(orgScoreSnapshotsTable)
    .where(and(eq(orgScoreSnapshotsTable.userId, userId), gte(orgScoreSnapshotsTable.date, cutoff)))
    .orderBy(orgScoreSnapshotsTable.date);

  res.json(snapshots);
});

router.post("/stats/org-trend/record", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [filesStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      organized: sql<number>`count(*) filter (where status = 'organized')::int`,
      renamed: sql<number>`count(*) filter (where status = 'renamed')::int`,
    })
    .from(filesTable)
    .where(eq(filesTable.userId, userId));

  const total = filesStats?.total ?? 0;
  const organized = filesStats?.organized ?? 0;
  const renamed = filesStats?.renamed ?? 0;
  const score = total > 0 ? Math.round(((organized + renamed) / total) * 100) : 0;
  const today = new Date().toISOString().split("T")[0];

  const [snapshot] = await db
    .insert(orgScoreSnapshotsTable)
    .values({ userId, date: today, score, totalFiles: total, organizedFiles: organized, renamedFiles: renamed })
    .onConflictDoUpdate({
      target: [orgScoreSnapshotsTable.userId, orgScoreSnapshotsTable.date],
      set: { score, totalFiles: total, organizedFiles: organized, renamedFiles: renamed },
    })
    .returning();

  res.json(snapshot);
});

export default router;

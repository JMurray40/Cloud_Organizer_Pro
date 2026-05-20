import { Router, type IRouter } from "express";
import { db, filesTable, cloudAccountsTable, namingRulesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/dashboard", async (_req, res): Promise<void> => {
  const [filesStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      organized: sql<number>`count(*) filter (where status = 'organized')::int`,
      renamed: sql<number>`count(*) filter (where status = 'renamed')::int`,
      duplicates: sql<number>`count(*) filter (where is_duplicate = true)::int`,
    })
    .from(filesTable);

  const [accountsStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cloudAccountsTable)
    .where(eq(cloudAccountsTable.isActive, true));

  const [rulesStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(namingRulesTable)
    .where(eq(namingRulesTable.isActive, true));

  const fileTypeRows = await db
    .select({
      ext: filesTable.fileExtension,
      count: sql<number>`count(*)::int`,
    })
    .from(filesTable)
    .groupBy(filesTable.fileExtension)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  const [sizeSavings] = await db
    .select({
      totalDupBytes: sql<number>`coalesce(sum(file_size) filter (where is_duplicate = true), 0)::bigint`,
    })
    .from(filesTable);

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

router.get("/stats/category-breakdown", async (_req, res): Promise<void> => {
  const breakdown = await db
    .select({
      category: filesTable.category,
      count: sql<number>`count(*)::int`,
    })
    .from(filesTable)
    .groupBy(filesTable.category)
    .orderBy(sql`count(*) desc`);

  res.json(breakdown);
});

router.get("/stats/recent-activity", async (_req, res): Promise<void> => {
  const recent = await db
    .select()
    .from(filesTable)
    .orderBy(desc(filesTable.updatedAt))
    .limit(10);

  res.json(recent);
});

export default router;

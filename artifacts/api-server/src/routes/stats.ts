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

  res.json({
    totalFiles: filesStats?.total ?? 0,
    pendingFiles: filesStats?.pending ?? 0,
    organizedFiles: filesStats?.organized ?? 0,
    duplicatesFound: filesStats?.duplicates ?? 0,
    cloudAccounts: accountsStats?.count ?? 0,
    activeRules: rulesStats?.count ?? 0,
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

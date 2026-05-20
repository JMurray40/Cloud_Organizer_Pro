import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cloudAccountsTable } from "@workspace/db";
import {
  CreateCloudAccountBody,
  UpdateCloudAccountBody,
  UpdateCloudAccountParams,
  DeleteCloudAccountParams,
} from "@workspace/api-zod";
import { getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/cloud-accounts", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const accounts = await db
    .select()
    .from(cloudAccountsTable)
    .where(eq(cloudAccountsTable.userId, userId))
    .orderBy(cloudAccountsTable.createdAt);
  res.json(accounts);
});

router.get("/cloud-accounts/recommend-placement", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const fileSizeGb = req.query.fileSizeGb ? parseFloat(req.query.fileSizeGb as string) : 0;

  const accounts = await db
    .select()
    .from(cloudAccountsTable)
    .where(and(eq(cloudAccountsTable.userId, userId), eq(cloudAccountsTable.isActive, true)))
    .orderBy(cloudAccountsTable.createdAt);

  const summaries = accounts.map((a) => {
    const total = a.quotaTotalGb ?? null;
    const used = a.quotaUsedGb ?? null;
    const free = total != null && used != null ? total - used : null;
    const pct = total != null && used != null && total > 0 ? (used / total) * 100 : null;
    return { id: a.id, name: a.name, provider: a.provider, quotaTotalGb: total, quotaUsedGb: used, freeGb: free, percentUsed: pct };
  });

  const eligible = summaries.filter((s) => s.freeGb != null && s.freeGb >= fileSizeGb);
  eligible.sort((a, b) => (b.freeGb ?? 0) - (a.freeGb ?? 0));

  const best = eligible[0] ?? null;

  res.json({
    recommendedAccountId: best?.id ?? null,
    recommendedAccountName: best?.name ?? "No suitable account",
    reason: best
      ? `${best.name} has the most free space (${best.freeGb?.toFixed(1)} GB available)`
      : fileSizeGb > 0
        ? `No account has enough free space for a ${fileSizeGb} GB file`
        : "No active accounts with quota data",
    accounts: summaries,
  });
});

router.post("/cloud-accounts", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateCloudAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db
    .insert(cloudAccountsTable)
    .values({
      userId,
      ...parsed.data,
      rootPath: parsed.data.rootPath ?? null,
      quotaTotalGb: parsed.data.quotaTotalGb ?? null,
      quotaUsedGb: parsed.data.quotaUsedGb ?? null,
      // Client cannot mark themselves as OAuth-connected; only the /oauth/callback flow can.
      connectedViaOAuth: false,
      isActive: true,
      fileCount: 0,
    })
    .returning();

  res.status(201).json(account);
});

router.patch("/cloud-accounts/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateCloudAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCloudAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db
    .update(cloudAccountsTable)
    .set(parsed.data)
    .where(and(eq(cloudAccountsTable.id, params.data.id), eq(cloudAccountsTable.userId, userId)))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Cloud account not found" });
    return;
  }

  res.json(account);
});

router.delete("/cloud-accounts/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteCloudAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [account] = await db
    .delete(cloudAccountsTable)
    .where(and(eq(cloudAccountsTable.id, params.data.id), eq(cloudAccountsTable.userId, userId)))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Cloud account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;

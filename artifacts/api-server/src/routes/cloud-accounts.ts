import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, cloudAccountsTable } from "@workspace/db";
import {
  CreateCloudAccountBody,
  UpdateCloudAccountBody,
  UpdateCloudAccountParams,
  DeleteCloudAccountParams,
} from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/cloud-accounts", async (_req, res): Promise<void> => {
  const accounts = await db.select().from(cloudAccountsTable).orderBy(cloudAccountsTable.createdAt);
  res.json(accounts);
});

router.get("/cloud-accounts/recommend-placement", async (req, res): Promise<void> => {
  const fileSizeGb = req.query.fileSizeGb ? parseFloat(req.query.fileSizeGb as string) : 0;

  const accounts = await db.select().from(cloudAccountsTable)
    .where(eq(cloudAccountsTable.isActive, true))
    .orderBy(cloudAccountsTable.createdAt);

  const summaries = accounts.map((a) => {
    const total = a.quotaTotalGb ?? null;
    const used = a.quotaUsedGb ?? null;
    const free = total != null && used != null ? total - used : null;
    const pct = total != null && used != null && total > 0 ? (used / total) * 100 : null;
    return { id: a.id, name: a.name, provider: a.provider, quotaTotalGb: total, quotaUsedGb: used, freeGb: free, percentUsed: pct };
  });

  const eligible = summaries.filter((s) => s.freeGb != null && s.freeGb >= fileSizeGb);
  eligible.sort((a, b) => {
    const aFree = a.freeGb ?? 0;
    const bFree = b.freeGb ?? 0;
    return bFree - aFree;
  });

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
  const parsed = CreateCloudAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db
    .insert(cloudAccountsTable)
    .values({
      ...parsed.data,
      rootPath: parsed.data.rootPath ?? null,
      quotaTotalGb: parsed.data.quotaTotalGb ?? null,
      quotaUsedGb: parsed.data.quotaUsedGb ?? null,
      connectedViaOAuth: parsed.data.connectedViaOAuth ?? false,
      isActive: true,
      fileCount: 0,
    })
    .returning();

  res.status(201).json(account);
});

router.patch("/cloud-accounts/:id", async (req, res): Promise<void> => {
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
    .where(eq(cloudAccountsTable.id, params.data.id))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Cloud account not found" });
    return;
  }

  res.json(account);
});

router.delete("/cloud-accounts/:id", async (req, res): Promise<void> => {
  const params = DeleteCloudAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [account] = await db
    .delete(cloudAccountsTable)
    .where(eq(cloudAccountsTable.id, params.data.id))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Cloud account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;

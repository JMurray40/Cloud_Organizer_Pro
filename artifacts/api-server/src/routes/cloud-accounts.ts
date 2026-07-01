import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cloudAccountsTable, filesTable } from "@workspace/db";
import {
  CreateCloudAccountBody,
  UpdateCloudAccountBody,
  UpdateCloudAccountParams,
  DeleteCloudAccountParams,
} from "@workspace/api-zod";
import { getUserId } from "../middlewares/requireAuth";
import { supportsSync } from "../lib/cloud-sync";
import { syncAccount, SyncError } from "../lib/sync-account";

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

  // Null out cloudAccountId on any files that referenced this account
  await db
    .update(filesTable)
    .set({ cloudAccountId: null })
    .where(and(eq(filesTable.userId, userId), eq(filesTable.cloudAccountId, account.id)));

  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// POST /cloud-accounts/:id/sync — import file list from a connected provider
// ---------------------------------------------------------------------------

router.post("/cloud-accounts/:id/sync", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid account id" });
    return;
  }

  const [account] = await db
    .select()
    .from(cloudAccountsTable)
    .where(and(eq(cloudAccountsTable.id, id), eq(cloudAccountsTable.userId, userId)));
  if (!account) {
    res.status(404).json({ error: "Cloud account not found" });
    return;
  }
  if (!account.connectedViaOAuth) {
    res.status(400).json({ error: "This account is not connected via OAuth. Use Scan or Drop to add files manually." });
    return;
  }
  if (!supportsSync(account.provider)) {
    res.status(400).json({ error: `File listing is not available for ${account.provider}.` });
    return;
  }

  try {
    const result = await syncAccount(id, userId);
    res.json(result);
  } catch (err) {
    if (err instanceof SyncError) {
      const status = err.code === "not_found" ? 404
        : err.code === "no_token" || err.code === "not_oauth" || err.code === "not_supported" ? 400
        : err.code === "auth_failed" ? 401
        : 502;
      res.status(status).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Unexpected sync error" });
    }
  }
});

export default router;

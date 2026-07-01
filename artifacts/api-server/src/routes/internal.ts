import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, cloudAccountsTable } from "@workspace/db";
import { supportsSync } from "../lib/cloud-sync";
import { syncAccount, SyncError } from "../lib/sync-account";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// POST /internal/sync-all — triggered by Render cron job every 6 hours.
// Auth: Bearer token checked against CRON_SECRET env var.
// Not protected by Clerk — must be mounted before requireAuth in app.ts.
// ---------------------------------------------------------------------------
router.post("/internal/sync-all", async (req, res): Promise<void> => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "Background sync is not configured (CRON_SECRET not set)" });
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Find all OAuth-connected accounts whose provider supports file listing.
  const allAccounts = await db
    .select({ id: cloudAccountsTable.id, userId: cloudAccountsTable.userId, provider: cloudAccountsTable.provider })
    .from(cloudAccountsTable)
    .where(eq(cloudAccountsTable.connectedViaOAuth, true));

  const syncable = allAccounts.filter((a) => supportsSync(a.provider));

  logger.info({ total: allAccounts.length, syncable: syncable.length }, "cron sync-all started");

  const results: Array<{ accountId: number; provider: string; status: "ok" | "error"; detail?: string; imported?: number }> = [];

  for (const account of syncable) {
    try {
      const result = await syncAccount(account.id, account.userId);
      results.push({ accountId: account.id, provider: account.provider, status: "ok", imported: result.imported });
      logger.info({ accountId: account.id, provider: account.provider, ...result }, "cron sync succeeded");
    } catch (err) {
      const msg = err instanceof SyncError ? err.message : String(err);
      results.push({ accountId: account.id, provider: account.provider, status: "error", detail: msg });
      logger.warn({ accountId: account.id, provider: account.provider, err: msg }, "cron sync failed — skipping");
    }
  }

  const succeeded = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;
  const totalImported = results.reduce((sum, r) => sum + (r.imported ?? 0), 0);

  logger.info({ succeeded, failed, totalImported }, "cron sync-all complete");

  res.json({ succeeded, failed, totalImported, results });
});

export default router;

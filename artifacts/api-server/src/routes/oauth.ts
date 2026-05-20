import { Router, type IRouter } from "express";
import { and, eq, lt } from "drizzle-orm";
import { db, cloudAccountsTable, oauthStatesTable } from "@workspace/db";
import { getUserId } from "../middlewares/requireAuth";
import { randomBytes } from "crypto";

const router: IRouter = Router();

const PROVIDER_CONFIG: Record<string, {
  label: string;
  defaultQuotaGb: number;
  defaultUsedGb: number;
  rootPath: string;
  authDomain: string;
}> = {
  google_drive: { label: "Google Drive", defaultQuotaGb: 15, defaultUsedGb: 4.2, rootPath: "/My Drive", authDomain: "accounts.google.com" },
  dropbox: { label: "Dropbox", defaultQuotaGb: 2, defaultUsedGb: 0.8, rootPath: "/", authDomain: "www.dropbox.com" },
  onedrive: { label: "OneDrive", defaultQuotaGb: 5, defaultUsedGb: 1.1, rootPath: "/Documents", authDomain: "login.microsoftonline.com" },
  icloud: { label: "iCloud Drive", defaultQuotaGb: 5, defaultUsedGb: 3.7, rootPath: "/iCloud Drive", authDomain: "appleid.apple.com" },
  box: { label: "Box", defaultQuotaGb: 10, defaultUsedGb: 2.3, rootPath: "/All Files", authDomain: "account.box.com" },
};

const STATE_TTL_MINUTES = 10;

router.get("/oauth/connect/:provider", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const provider = req.params.provider;
  const config = PROVIDER_CONFIG[provider];

  if (!config) {
    res.status(400).json({ error: `Unsupported provider: ${provider}` });
    return;
  }

  // Cryptographically random state (vs. predictable Date.now+Math.random)
  const state = `fileorbit_${provider}_${randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000);

  await db.insert(oauthStatesTable).values({ state, userId, provider, expiresAt });

  // Opportunistic cleanup of expired states
  await db.delete(oauthStatesTable).where(lt(oauthStatesTable.expiresAt, new Date()));

  res.json({
    provider,
    authUrl: `https://${config.authDomain}/oauth2/authorize?client_id=fileorbit-demo&redirect_uri=${encodeURIComponent("https://fileorbit.app/oauth/callback")}&scope=files.read+files.write&state=${state}&response_type=code`,
    state,
    instructions: `In a real deployment, this would redirect you to ${config.label} to authorize FileOrbit. Click "Simulate Connection" to connect with demo account data.`,
  });
});

router.post("/oauth/callback/:provider", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const provider = req.params.provider;
  const config = PROVIDER_CONFIG[provider];

  if (!config) {
    res.status(400).json({ error: `Unsupported provider: ${provider}` });
    return;
  }

  const { state, accountLabel, accountName, simulatedQuotaTotalGb, simulatedQuotaUsedGb } = req.body;

  if (!state || !accountLabel || !accountName) {
    res.status(400).json({ error: "Missing required fields: state, accountLabel, accountName" });
    return;
  }

  // Verify state belongs to THIS user + provider, and is unexpired
  const [stateRow] = await db
    .select()
    .from(oauthStatesTable)
    .where(
      and(
        eq(oauthStatesTable.state, state),
        eq(oauthStatesTable.userId, userId),
        eq(oauthStatesTable.provider, provider),
      ),
    );

  if (!stateRow) {
    res.status(400).json({ error: "Invalid or expired state" });
    return;
  }
  if (stateRow.expiresAt.getTime() < Date.now()) {
    await db.delete(oauthStatesTable).where(eq(oauthStatesTable.state, state));
    res.status(400).json({ error: "OAuth state expired — please reconnect" });
    return;
  }

  // Single-use: consume the state immediately
  await db.delete(oauthStatesTable).where(eq(oauthStatesTable.state, state));

  const totalGb = simulatedQuotaTotalGb ?? config.defaultQuotaGb;
  const usedGb = simulatedQuotaUsedGb ?? config.defaultUsedGb;

  const [account] = await db
    .insert(cloudAccountsTable)
    .values({
      userId,
      name: accountName,
      provider,
      accountLabel,
      rootPath: config.rootPath,
      isActive: true,
      fileCount: 0,
      quotaTotalGb: totalGb,
      quotaUsedGb: usedGb,
      connectedViaOAuth: true,
    })
    .returning();

  res.status(201).json(account);
});

export default router;

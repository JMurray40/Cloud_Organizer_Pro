import { Router, type IRouter } from "express";
import { db, cloudAccountsTable } from "@workspace/db";

const router: IRouter = Router();

const PROVIDER_CONFIG: Record<string, {
  label: string;
  defaultQuotaGb: number;
  defaultUsedGb: number;
  rootPath: string;
  authDomain: string;
}> = {
  google_drive: {
    label: "Google Drive",
    defaultQuotaGb: 15,
    defaultUsedGb: 4.2,
    rootPath: "/My Drive",
    authDomain: "accounts.google.com",
  },
  dropbox: {
    label: "Dropbox",
    defaultQuotaGb: 2,
    defaultUsedGb: 0.8,
    rootPath: "/",
    authDomain: "www.dropbox.com",
  },
  onedrive: {
    label: "OneDrive",
    defaultQuotaGb: 5,
    defaultUsedGb: 1.1,
    rootPath: "/Documents",
    authDomain: "login.microsoftonline.com",
  },
  icloud: {
    label: "iCloud Drive",
    defaultQuotaGb: 5,
    defaultUsedGb: 3.7,
    rootPath: "/iCloud Drive",
    authDomain: "appleid.apple.com",
  },
  box: {
    label: "Box",
    defaultQuotaGb: 10,
    defaultUsedGb: 2.3,
    rootPath: "/All Files",
    authDomain: "account.box.com",
  },
};

router.get("/oauth/connect/:provider", async (req, res): Promise<void> => {
  const provider = req.params.provider;
  const config = PROVIDER_CONFIG[provider];

  if (!config) {
    res.status(400).json({ error: `Unsupported provider: ${provider}` });
    return;
  }

  const state = `fileorbit_${provider}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  res.json({
    provider,
    authUrl: `https://${config.authDomain}/oauth2/authorize?client_id=fileorbit-demo&redirect_uri=${encodeURIComponent("https://fileorbit.app/oauth/callback")}&scope=files.read+files.write&state=${state}&response_type=code`,
    state,
    instructions: `In a real deployment, this would redirect you to ${config.label} to authorize FileOrbit. Click "Simulate Connection" to connect with demo account data.`,
  });
});

router.post("/oauth/callback/:provider", async (req, res): Promise<void> => {
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

  const totalGb = simulatedQuotaTotalGb ?? config.defaultQuotaGb;
  const usedGb = simulatedQuotaUsedGb ?? config.defaultUsedGb;

  const [account] = await db
    .insert(cloudAccountsTable)
    .values({
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

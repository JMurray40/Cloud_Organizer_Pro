import { Router, type IRouter } from "express";
import { and, eq, lt } from "drizzle-orm";
import { db, cloudAccountsTable, oauthStatesTable, oauthTokensTable } from "@workspace/db";
import { getUserId } from "../middlewares/requireAuth";
import { randomBytes } from "crypto";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

type ConnectMode = "oauth" | "api-key" | "manual-only";

interface ProviderMeta {
  label: string;
  defaultQuotaGb: number;
  defaultUsedGb: number;
  rootPath: string;
  /** How this provider connects. "oauth" = redirect flow, "api-key" = user
   *  pastes credentials, "manual-only" = no API available. */
  connectMode: ConnectMode;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Extra query params appended to the authorization URL (provider-specific). */
  extraAuthParams?: Record<string, string>;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
}

const PROVIDERS: Record<string, ProviderMeta> = {
  google_drive: {
    label: "Google Drive",
    defaultQuotaGb: 15,
    defaultUsedGb: 4.2,
    rootPath: "/My Drive",
    connectMode: "oauth",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/drive.metadata.readonly",
      "openid",
      "email",
      "profile",
    ],
    // Google requires these to issue a refresh token on every consent
    extraAuthParams: { access_type: "offline", prompt: "consent" },
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
  },
  dropbox: {
    label: "Dropbox",
    defaultQuotaGb: 2,
    defaultUsedGb: 0.8,
    rootPath: "/",
    connectMode: "oauth",
    authUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropboxapi.com/oauth2/token",
    scopes: ["files.metadata.read", "account_info.read"],
    // Required to receive a refresh_token from Dropbox
    extraAuthParams: { token_access_type: "offline" },
    clientId: () => process.env.DROPBOX_CLIENT_ID,
    clientSecret: () => process.env.DROPBOX_CLIENT_SECRET,
  },
  onedrive: {
    label: "OneDrive",
    defaultQuotaGb: 5,
    defaultUsedGb: 1.1,
    rootPath: "/Documents",
    connectMode: "oauth",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["Files.Read", "User.Read", "offline_access"],
    clientId: () => process.env.ONEDRIVE_CLIENT_ID,
    clientSecret: () => process.env.ONEDRIVE_CLIENT_SECRET,
  },
  icloud: {
    label: "iCloud Drive",
    defaultQuotaGb: 5,
    defaultUsedGb: 3.7,
    rootPath: "/iCloud Drive",
    connectMode: "manual-only",
    authUrl: "",
    tokenUrl: "",
    scopes: [],
    clientId: () => undefined,
    clientSecret: () => undefined,
  },
  box: {
    label: "Box",
    defaultQuotaGb: 10,
    defaultUsedGb: 2.3,
    rootPath: "/All Files",
    connectMode: "oauth",
    authUrl: "https://account.box.com/api/oauth2/authorize",
    tokenUrl: "https://api.box.com/oauth2/token",
    scopes: ["root_readwrite"],
    clientId: () => process.env.BOX_CLIENT_ID,
    clientSecret: () => process.env.BOX_CLIENT_SECRET,
  },
  amazon_photos: {
    label: "Amazon Photos",
    defaultQuotaGb: 0,
    defaultUsedGb: 0,
    rootPath: "/Amazon Photos",
    connectMode: "oauth",
    authUrl: "https://www.amazon.com/ap/oa",
    tokenUrl: "https://api.amazon.com/auth/o2/token",
    scopes: ["profile"],
    clientId: () => process.env.AMAZON_CLIENT_ID,
    clientSecret: () => process.env.AMAZON_CLIENT_SECRET,
  },
  backblaze_b2: {
    label: "Backblaze B2",
    // B2 is pay-as-you-go with no fixed quota
    defaultQuotaGb: 0,
    defaultUsedGb: 0,
    rootPath: "/",
    // B2 uses Application Keys — no OAuth redirect flow exists
    connectMode: "api-key",
    authUrl: "",
    tokenUrl: "",
    scopes: [],
    clientId: () => undefined,
    clientSecret: () => undefined,
  },
  mega: {
    label: "MEGA",
    defaultQuotaGb: 20,
    defaultUsedGb: 0,
    rootPath: "/",
    // MEGA has no public OAuth API and no working developer registration;
    // E2E encryption prevents server-side file access — manual tracking only
    connectMode: "manual-only",
    authUrl: "",
    tokenUrl: "",
    scopes: [],
    clientId: () => undefined,
    clientSecret: () => undefined,
  },
};

const STATE_TTL_MINUTES = 10;

function isRealOAuth(meta: ProviderMeta): boolean {
  return meta.connectMode === "oauth" &&
    !!(meta.clientId() && meta.clientSecret() && meta.authUrl);
}

export function buildRedirectUri(providerKey: string): string {
  const base = (process.env.API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/api/oauth/callback/${providerKey}`;
}

// ---------------------------------------------------------------------------
// GET /oauth/connect/:provider — initiate OAuth flow
// Returns one of:
//   { mode: "real",     authUrl }           — redirect to provider
//   { mode: "api-key" }                     — show credential entry form
//   { mode: "simulate", state, instructions } — manual entry fallback
// ---------------------------------------------------------------------------
router.get("/oauth/connect/:provider", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const providerKey = req.params.provider;
  const meta = PROVIDERS[providerKey];

  if (!meta) {
    res.status(400).json({ error: `Unsupported provider: ${providerKey}` });
    return;
  }

  // API-key providers (e.g. Backblaze B2) use a credential form — no state needed
  if (meta.connectMode === "api-key") {
    res.json({ mode: "api-key" });
    return;
  }

  const state = `fileorbit_${providerKey}_${randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000);

  await db.insert(oauthStatesTable).values({ state, userId, provider: providerKey, expiresAt });
  // Opportunistic cleanup of expired states
  await db.delete(oauthStatesTable).where(lt(oauthStatesTable.expiresAt, new Date()));

  if (isRealOAuth(meta)) {
    const redirectUri = buildRedirectUri(providerKey);
    const params = new URLSearchParams({
      client_id: meta.clientId()!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: meta.scopes.join(" "),
      state,
      ...meta.extraAuthParams,
    });
    res.json({ mode: "real", authUrl: `${meta.authUrl}?${params}` });
    return;
  }

  const instructions = meta.connectMode === "manual-only"
    ? `${meta.label} does not offer a third-party API. Enter your account details below to track files manually using Scan or Drop.`
    : `${meta.label} credentials are not yet configured. Enter your account details below to track this account manually — you can reconnect with real OAuth credentials later.`;

  res.json({ mode: "simulate", state, instructions });
});

// ---------------------------------------------------------------------------
// POST /oauth/verify-key/:provider — API-key credential verification
// Used for providers like Backblaze B2 where the user supplies keys directly.
// ---------------------------------------------------------------------------
router.post("/oauth/verify-key/:provider", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const providerKey = req.params.provider;

  if (providerKey === "backblaze_b2") {
    const { keyId, applicationKey, accountName } = req.body as {
      keyId?: string;
      applicationKey?: string;
      accountName?: string;
    };

    if (!keyId || !applicationKey || !accountName) {
      res.status(400).json({ error: "Missing required fields: keyId, applicationKey, accountName" });
      return;
    }

    // Verify credentials against the B2 API
    const credentials = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!authRes.ok) {
      const errData = await authRes.json() as { message?: string; code?: string };
      res.status(400).json({
        error: "Invalid Backblaze credentials",
        detail: errData.message ?? errData.code ?? `HTTP ${authRes.status}`,
      });
      return;
    }

    const authData = await authRes.json() as { accountId: string };

    const [account] = await db
      .insert(cloudAccountsTable)
      .values({
        userId,
        name: accountName,
        provider: "backblaze_b2",
        // accountId is the closest thing to an email/label B2 provides
        accountLabel: authData.accountId,
        rootPath: "/",
        isActive: true,
        fileCount: 0,
        // B2 is pay-as-you-go — no fixed quota
        quotaTotalGb: null,
        quotaUsedGb: null,
        connectedViaOAuth: true,
      })
      .returning();

    // Store credentials: applicationKey as accessToken, keyId as refreshToken
    await db.insert(oauthTokensTable).values({
      userId,
      provider: "backblaze_b2",
      cloudAccountId: account.id,
      accessToken: applicationKey,
      refreshToken: keyId,
      expiresAt: null,
      scope: null,
    });

    res.status(201).json(account);
    return;
  }

  res.status(400).json({ error: `No API-key handler for provider: ${providerKey}` });
});

// ---------------------------------------------------------------------------
// POST /oauth/callback/:provider — simulated OAuth (no real provider involved)
// Used when real credentials are not yet set up.
// ---------------------------------------------------------------------------
router.post("/oauth/callback/:provider", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const providerKey = req.params.provider;
  const meta = PROVIDERS[providerKey];

  if (!meta) {
    res.status(400).json({ error: `Unsupported provider: ${providerKey}` });
    return;
  }

  const { state, accountLabel, accountName, simulatedQuotaTotalGb, simulatedQuotaUsedGb } = req.body;

  if (!state || !accountLabel || !accountName) {
    res.status(400).json({ error: "Missing required fields: state, accountLabel, accountName" });
    return;
  }

  const [stateRow] = await db
    .select()
    .from(oauthStatesTable)
    .where(
      and(
        eq(oauthStatesTable.state, state),
        eq(oauthStatesTable.userId, userId),
        eq(oauthStatesTable.provider, providerKey),
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

  await db.delete(oauthStatesTable).where(eq(oauthStatesTable.state, state));

  const [account] = await db
    .insert(cloudAccountsTable)
    .values({
      userId,
      name: accountName,
      provider: providerKey,
      accountLabel,
      rootPath: meta.rootPath,
      isActive: true,
      fileCount: 0,
      quotaTotalGb: simulatedQuotaTotalGb ?? (meta.defaultQuotaGb || null),
      quotaUsedGb: simulatedQuotaUsedGb ?? (meta.defaultUsedGb || null),
      connectedViaOAuth: false,
    })
    .returning();

  res.status(201).json(account);
});

export default router;

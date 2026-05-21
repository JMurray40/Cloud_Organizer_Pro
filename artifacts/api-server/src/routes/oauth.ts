import { Router, type IRouter } from "express";
import { and, eq, lt } from "drizzle-orm";
import { db, cloudAccountsTable, oauthStatesTable } from "@workspace/db";
import { getUserId } from "../middlewares/requireAuth";
import { randomBytes } from "crypto";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Provider registry
// Each provider declares its OAuth endpoints and credential env vars.
// When clientId / clientSecret are absent the flow falls back to simulation.
// ---------------------------------------------------------------------------

interface ProviderMeta {
  label: string;
  defaultQuotaGb: number;
  defaultUsedGb: number;
  rootPath: string;
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
    // iCloud does not offer a standard OAuth2 API — simulation only for now
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
    authUrl: "https://account.box.com/api/oauth2/authorize",
    tokenUrl: "https://api.box.com/oauth2/token",
    scopes: ["root_readwrite"],
    clientId: () => process.env.BOX_CLIENT_ID,
    clientSecret: () => process.env.BOX_CLIENT_SECRET,
  },
  amazon_photos: {
    label: "Amazon Photos",
    // Amazon Photos is unlimited for Prime members — quota not tracked
    defaultQuotaGb: 0,
    defaultUsedGb: 0,
    rootPath: "/Amazon Photos",
    authUrl: "https://www.amazon.com/ap/oa",
    tokenUrl: "https://api.amazon.com/auth/o2/token",
    // profile scope gives name + email via LWA; Amazon Drive API is closed
    // to new third-party apps so photo metadata access is not available
    scopes: ["profile"],
    clientId: () => process.env.AMAZON_CLIENT_ID,
    clientSecret: () => process.env.AMAZON_CLIENT_SECRET,
  },
};

const STATE_TTL_MINUTES = 10;

function isRealOAuth(meta: ProviderMeta): boolean {
  return !!(meta.clientId() && meta.clientSecret() && meta.authUrl);
}

export function buildRedirectUri(providerKey: string): string {
  const base = (process.env.API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/api/oauth/callback/${providerKey}`;
}

// ---------------------------------------------------------------------------
// GET /oauth/connect/:provider — initiate OAuth flow
// Returns { mode: "real", authUrl } or { mode: "simulate", state, instructions }
// ---------------------------------------------------------------------------
router.get("/oauth/connect/:provider", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const providerKey = req.params.provider;
  const meta = PROVIDERS[providerKey];

  if (!meta) {
    res.status(400).json({ error: `Unsupported provider: ${providerKey}` });
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

  res.json({
    mode: "simulate",
    state,
    instructions: `${meta.label} credentials are not yet configured. Enter your account details below to track this account manually — you can reconnect with real OAuth credentials later.`,
  });
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
      quotaTotalGb: simulatedQuotaTotalGb ?? meta.defaultQuotaGb,
      quotaUsedGb: simulatedQuotaUsedGb ?? meta.defaultUsedGb,
      connectedViaOAuth: false,
    })
    .returning();

  res.status(201).json(account);
});

export default router;

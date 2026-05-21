import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, cloudAccountsTable, oauthStatesTable, oauthTokensTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { buildRedirectUri } from "./oauth";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface ProviderInfo {
  name: string;
  email: string;
  quotaTotalGb: number | null;
  quotaUsedGb: number | null;
  rootPath: string;
}

const bytesToGb = (bytes: number) => bytes / 1024 ** 3;

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

async function exchangeGoogleCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? `Google token exchange HTTP ${res.status}`);
  }
  return data;
}

async function getGoogleDriveInfo(accessToken: string): Promise<ProviderInfo> {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/about?fields=storageQuota,user",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Google Drive /about HTTP ${res.status}`);
  const about = await res.json() as {
    storageQuota: { limit?: string; usage?: string };
    user: { displayName: string; emailAddress: string };
  };
  const strToGb = (s?: string) => (s != null ? parseInt(s, 10) / 1024 ** 3 : null);
  return {
    name: about.user.displayName,
    email: about.user.emailAddress,
    quotaTotalGb: strToGb(about.storageQuota.limit),
    quotaUsedGb: strToGb(about.storageQuota.usage),
    rootPath: "/My Drive",
  };
}

// ---------------------------------------------------------------------------
// Dropbox
// ---------------------------------------------------------------------------

async function exchangeDropboxCode(code: string, redirectUri: string): Promise<TokenResponse> {
  // Dropbox requires Basic auth (client_id:client_secret) for token exchange
  const credentials = Buffer.from(
    `${process.env.DROPBOX_CLIENT_ID}:${process.env.DROPBOX_CLIENT_SECRET}`,
  ).toString("base64");
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? `Dropbox token exchange HTTP ${res.status}`);
  }
  return data;
}

async function getDropboxInfo(accessToken: string): Promise<ProviderInfo> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const [accountRes, spaceRes] = await Promise.all([
    fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers,
      body: "null",
    }),
    fetch("https://api.dropboxapi.com/2/users/get_space_usage", {
      method: "POST",
      headers,
      body: "null",
    }),
  ]);
  if (!accountRes.ok) throw new Error(`Dropbox /users/get_current_account HTTP ${accountRes.status}`);
  if (!spaceRes.ok) throw new Error(`Dropbox /users/get_space_usage HTTP ${spaceRes.status}`);

  const account = await accountRes.json() as {
    name: { display_name: string };
    email: string;
  };
  const space = await spaceRes.json() as {
    used: number;
    allocation?: { ".tag": string; allocated?: number };
  };

  return {
    name: account.name.display_name,
    email: account.email,
    quotaTotalGb: space.allocation?.allocated != null ? bytesToGb(space.allocation.allocated) : null,
    quotaUsedGb: bytesToGb(space.used),
    rootPath: "/",
  };
}

// ---------------------------------------------------------------------------
// OneDrive (Microsoft Graph)
// ---------------------------------------------------------------------------

async function exchangeOneDriveCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.ONEDRIVE_CLIENT_ID!,
    client_secret: process.env.ONEDRIVE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? `OneDrive token exchange HTTP ${res.status}`);
  }
  return data;
}

async function getOneDriveInfo(accessToken: string): Promise<ProviderInfo> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [meRes, driveRes] = await Promise.all([
    fetch("https://graph.microsoft.com/v1.0/me", { headers }),
    fetch("https://graph.microsoft.com/v1.0/me/drive", { headers }),
  ]);
  if (!meRes.ok) throw new Error(`Graph /me HTTP ${meRes.status}`);
  if (!driveRes.ok) throw new Error(`Graph /me/drive HTTP ${driveRes.status}`);

  const me = await meRes.json() as { displayName: string; mail?: string; userPrincipalName: string };
  const drive = await driveRes.json() as { quota?: { total: number; used: number } };

  return {
    name: me.displayName,
    email: me.mail ?? me.userPrincipalName,
    quotaTotalGb: drive.quota?.total != null ? bytesToGb(drive.quota.total) : null,
    quotaUsedGb: drive.quota?.used != null ? bytesToGb(drive.quota.used) : null,
    rootPath: "/Documents",
  };
}

// ---------------------------------------------------------------------------
// Box
// ---------------------------------------------------------------------------

async function exchangeBoxCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.BOX_CLIENT_ID!,
    client_secret: process.env.BOX_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://api.box.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? `Box token exchange HTTP ${res.status}`);
  }
  return data;
}

async function getBoxInfo(accessToken: string): Promise<ProviderInfo> {
  const res = await fetch(
    "https://api.box.com/2.0/users/me?fields=name,login,space_used,space_amount",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Box /users/me HTTP ${res.status}`);
  const user = await res.json() as {
    name: string;
    login: string;
    space_used: number;
    space_amount: number;
  };
  return {
    name: user.name,
    email: user.login,
    quotaTotalGb: user.space_amount != null ? bytesToGb(user.space_amount) : null,
    quotaUsedGb: user.space_used != null ? bytesToGb(user.space_used) : null,
    rootPath: "/All Files",
  };
}

// ---------------------------------------------------------------------------
// Provider dispatch table
// ---------------------------------------------------------------------------

type ExchangeFn = (code: string, redirectUri: string) => Promise<TokenResponse>;
type InfoFn = (accessToken: string) => Promise<ProviderInfo>;

const HANDLERS: Record<string, { exchange: ExchangeFn; info: InfoFn }> = {
  google_drive: { exchange: exchangeGoogleCode, info: getGoogleDriveInfo },
  dropbox:      { exchange: exchangeDropboxCode, info: getDropboxInfo },
  onedrive:     { exchange: exchangeOneDriveCode, info: getOneDriveInfo },
  box:          { exchange: exchangeBoxCode, info: getBoxInfo },
};

// ---------------------------------------------------------------------------
// GET /oauth/callback/:provider
// Browser redirect from the OAuth provider — no Clerk token, no requireAuth.
// State param is the only link back to the initiating user.
// ---------------------------------------------------------------------------
router.get("/oauth/callback/:provider", async (req, res): Promise<void> => {
  const { provider } = req.params;
  const { code, state, error } = req.query as Record<string, string | undefined>;

  const frontendUrl = (process.env.FRONTEND_URL ?? "").replace(/\/$/, "");
  const fail = (reason?: string) =>
    res.redirect(
      `${frontendUrl}/accounts?oauth_error=true${reason ? `&reason=${reason}` : ""}`,
    );

  if (error || !code || !state) {
    logger.warn({ provider, error }, "oauth callback: provider returned error or missing params");
    fail(error ?? "missing_params");
    return;
  }

  const handler = HANDLERS[provider];
  if (!handler) {
    logger.warn({ provider }, "oauth callback: no handler for provider");
    fail("unsupported_provider");
    return;
  }

  const [stateRow] = await db
    .select()
    .from(oauthStatesTable)
    .where(and(eq(oauthStatesTable.state, state), eq(oauthStatesTable.provider, provider)));

  if (!stateRow) {
    logger.warn({ provider }, "oauth callback: state not found");
    fail("invalid_state");
    return;
  }

  if (stateRow.expiresAt.getTime() < Date.now()) {
    await db.delete(oauthStatesTable).where(eq(oauthStatesTable.state, state));
    logger.warn({ provider }, "oauth callback: state expired");
    fail("expired");
    return;
  }

  // Consume state (single-use CSRF token)
  await db.delete(oauthStatesTable).where(eq(oauthStatesTable.state, state));

  const { userId } = stateRow;
  const redirectUri = buildRedirectUri(provider);

  try {
    const tokens = await handler.exchange(code, redirectUri);
    const info = await handler.info(tokens.access_token);

    const [account] = await db
      .insert(cloudAccountsTable)
      .values({
        userId,
        name: info.name,
        provider,
        accountLabel: info.email,
        rootPath: info.rootPath,
        isActive: true,
        fileCount: 0,
        quotaTotalGb: info.quotaTotalGb,
        quotaUsedGb: info.quotaUsedGb,
        connectedViaOAuth: true,
      })
      .returning();

    await db.insert(oauthTokensTable).values({
      userId,
      provider,
      cloudAccountId: account.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      scope: tokens.scope ?? null,
    });

    logger.info({ userId, provider, accountId: account.id }, "oauth account connected");
    res.redirect(`${frontendUrl}/accounts?connected=${provider}`);
  } catch (err) {
    logger.error({ err, provider, userId }, "oauth callback failed");
    fail("server_error");
  }
});

export default router;

import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, cloudAccountsTable, oauthStatesTable, oauthTokensTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { buildRedirectUri } from "./oauth";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Token + user-info types
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

interface GoogleDriveAbout {
  storageQuota: {
    limit?: string;
    usage?: string;
  };
  user: {
    displayName: string;
    emailAddress: string;
  };
}

// ---------------------------------------------------------------------------
// Google Drive helpers
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
    throw new Error(data.error_description ?? data.error ?? `Token exchange HTTP ${res.status}`);
  }
  return data;
}

async function getGoogleDriveInfo(accessToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/about?fields=storageQuota,user",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    throw new Error(`Drive /about HTTP ${res.status}`);
  }

  const about = (await res.json()) as GoogleDriveAbout;
  const toGb = (bytes?: string) =>
    bytes != null ? parseInt(bytes, 10) / 1024 ** 3 : null;

  return {
    name: about.user.displayName,
    email: about.user.emailAddress,
    quotaTotalGb: toGb(about.storageQuota.limit),
    quotaUsedGb: toGb(about.storageQuota.usage),
    rootPath: "/My Drive",
  };
}

// ---------------------------------------------------------------------------
// GET /oauth/callback/:provider
// Browser redirect from the OAuth provider — no Clerk token, no requireAuth.
// State param is the link back to the initiating user.
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
    logger.warn({ provider, error }, "oauth callback: provider error or missing params");
    fail(error ?? "missing_params");
    return;
  }

  const [stateRow] = await db
    .select()
    .from(oauthStatesTable)
    .where(
      and(
        eq(oauthStatesTable.state, state),
        eq(oauthStatesTable.provider, provider),
      ),
    );

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
    let info: { name: string; email: string; quotaTotalGb: number | null; quotaUsedGb: number | null; rootPath: string };
    let tokens: TokenResponse;

    if (provider === "google_drive") {
      tokens = await exchangeGoogleCode(code, redirectUri);
      info = await getGoogleDriveInfo(tokens.access_token);
    } else {
      // Future providers (Dropbox, OneDrive, Box) added here
      logger.warn({ provider }, "oauth callback: real handler not yet implemented");
      fail("unsupported_provider");
      return;
    }

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
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
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

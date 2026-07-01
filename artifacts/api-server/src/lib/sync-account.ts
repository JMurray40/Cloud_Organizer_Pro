import { and, eq, count as drizzleCount } from "drizzle-orm";
import { db, cloudAccountsTable, oauthTokensTable, filesTable } from "@workspace/db";
import { safeDecrypt, encrypt } from "./encrypt";
import { listProviderFiles, supportsSync } from "./cloud-sync";
import { refreshAccessToken } from "./token-refresh";
import { applyNamingConvention } from "./naming";
import { detectCategory, detectSubCategory } from "../routes/files";

export type SyncErrorCode =
  | "not_found"
  | "not_oauth"
  | "not_supported"
  | "no_token"
  | "auth_failed"
  | "provider_error";

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code: SyncErrorCode,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export interface SyncResult {
  imported: number;
  skipped: number;
  total: number;
}

/**
 * Sync file metadata from the cloud provider into the local DB for one account.
 * Throws SyncError on all expected failure modes; the caller decides how to surface them.
 */
export async function syncAccount(accountId: number, userId: string): Promise<SyncResult> {
  const [account] = await db
    .select()
    .from(cloudAccountsTable)
    .where(and(eq(cloudAccountsTable.id, accountId), eq(cloudAccountsTable.userId, userId)));

  if (!account) throw new SyncError("Cloud account not found", "not_found");
  if (!account.connectedViaOAuth) throw new SyncError("Account is not connected via OAuth", "not_oauth");
  if (!supportsSync(account.provider)) throw new SyncError(`Sync not supported for ${account.provider}`, "not_supported");

  const [tokenRow] = await db
    .select()
    .from(oauthTokensTable)
    .where(and(eq(oauthTokensTable.cloudAccountId, accountId), eq(oauthTokensTable.userId, userId)));

  if (!tokenRow) throw new SyncError("No credentials found — please reconnect this account", "no_token");

  // Persists a refreshed token to the DB and returns the plaintext access token.
  const applyRefresh = async (plainRefreshToken: string): Promise<string> => {
    const result = await refreshAccessToken(account.provider, plainRefreshToken);
    await db
      .update(oauthTokensTable)
      .set({
        accessToken: encrypt(result.accessToken),
        ...(result.refreshToken ? { refreshToken: encrypt(result.refreshToken) } : {}),
        ...(result.expiresAt !== null ? { expiresAt: result.expiresAt } : {}),
      })
      .where(eq(oauthTokensTable.id, tokenRow.id));
    return result.accessToken;
  };

  let accessToken = safeDecrypt(tokenRow.accessToken);

  // Proactive refresh when the token is expired or within 5 minutes of expiry.
  if (tokenRow.refreshToken && tokenRow.expiresAt) {
    const fiveMinutes = 5 * 60 * 1000;
    if (tokenRow.expiresAt.getTime() - Date.now() < fiveMinutes) {
      try {
        accessToken = await applyRefresh(safeDecrypt(tokenRow.refreshToken));
      } catch {
        // Continue with the existing token; a reactive refresh will run below if it fails.
      }
    }
  }

  // Fetch file list from provider.
  let remoteFiles: Awaited<ReturnType<typeof listProviderFiles>>;
  try {
    remoteFiles = await listProviderFiles(account.provider, accessToken);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const isAuthError = detail.includes("HTTP 401") || detail.includes("HTTP 403");

    if (isAuthError && tokenRow.refreshToken) {
      // Reactive refresh on 401/403.
      let freshToken: string;
      try {
        freshToken = await applyRefresh(safeDecrypt(tokenRow.refreshToken));
      } catch (refreshErr) {
        const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        throw new SyncError(`Token expired and auto-refresh failed: ${msg}`, "auth_failed");
      }
      try {
        remoteFiles = await listProviderFiles(account.provider, freshToken);
      } catch (retryErr) {
        const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        throw new SyncError(msg, "provider_error");
      }
    } else if (isAuthError) {
      throw new SyncError("Access token expired or revoked — please reconnect", "auth_failed");
    } else {
      throw new SyncError(detail, "provider_error");
    }
  }

  // Insert only files not already tracked for this account.
  const existing = await db
    .select({ originalName: filesTable.originalName })
    .from(filesTable)
    .where(and(eq(filesTable.userId, userId), eq(filesTable.cloudAccountId, accountId)));
  const existingNames = new Set(existing.map((f) => f.originalName));

  const toInsert = remoteFiles.filter((f) => !existingNames.has(f.name));

  if (toInsert.length > 0) {
    const rows = toInsert.map((f) => {
      const cat = detectCategory(f.name);
      const sub = detectSubCategory(f.name, cat);
      const suggestion = applyNamingConvention(f.name, cat, sub);
      return {
        userId,
        originalName: f.name,
        suggestedName: suggestion.suggestedName,
        currentName: f.name,
        category: cat,
        subCategory: sub ?? null,
        suggestedPath: suggestion.suggestedPath,
        cloudAccountId: accountId,
        fileSize: f.sizeBytes ?? null,
        fileExtension: suggestion.extension,
        notes: null as string | null,
        isDuplicate: false,
        status: "pending",
      };
    });
    for (let i = 0; i < rows.length; i += 200) {
      await db.insert(filesTable).values(rows.slice(i, i + 200));
    }
  }

  // Keep fileCount accurate.
  const [{ count: actualCount }] = await db
    .select({ count: drizzleCount() })
    .from(filesTable)
    .where(and(eq(filesTable.userId, userId), eq(filesTable.cloudAccountId, accountId)));
  await db
    .update(cloudAccountsTable)
    .set({ fileCount: Number(actualCount) })
    .where(eq(cloudAccountsTable.id, accountId));

  return {
    imported: toInsert.length,
    skipped: remoteFiles.length - toInsert.length,
    total: remoteFiles.length,
  };
}

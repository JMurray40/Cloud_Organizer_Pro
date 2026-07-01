export interface RefreshResult {
  accessToken: string;
  /** New refresh token if the provider rotated it (Box always does). Null = keep the existing one. */
  refreshToken: string | null;
  expiresAt: Date | null;
}

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function callTokenEndpoint(
  url: string,
  body: URLSearchParams,
  basicCredentials?: string,
): Promise<RefreshResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (basicCredentials) {
    headers["Authorization"] = `Basic ${basicCredentials}`;
  }

  const res = await fetch(url, { method: "POST", headers, body: body.toString() });
  const data = (await res.json()) as RawTokenResponse;

  if (!res.ok || !data.access_token || data.error) {
    throw new Error(
      data.error_description ?? data.error ?? `Token refresh HTTP ${res.status}`,
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in != null
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
  };
}

export async function refreshAccessToken(
  provider: string,
  refreshToken: string,
): Promise<RefreshResult> {
  switch (provider) {
    case "google_drive":
      return callTokenEndpoint(
        "https://oauth2.googleapis.com/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      );

    case "dropbox": {
      const creds = Buffer.from(
        `${process.env.DROPBOX_CLIENT_ID}:${process.env.DROPBOX_CLIENT_SECRET}`,
      ).toString("base64");
      return callTokenEndpoint(
        "https://api.dropboxapi.com/oauth2/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
        creds,
      );
    }

    case "onedrive":
      return callTokenEndpoint(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: process.env.ONEDRIVE_CLIENT_ID!,
          client_secret: process.env.ONEDRIVE_CLIENT_SECRET!,
          scope: "Files.Read User.Read offline_access",
        }),
      );

    case "box":
      // Box always rotates the refresh token — the old one is invalidated immediately.
      // The new refresh_token MUST be saved or the user is locked out.
      return callTokenEndpoint(
        "https://api.box.com/oauth2/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: process.env.BOX_CLIENT_ID!,
          client_secret: process.env.BOX_CLIENT_SECRET!,
        }),
      );

    case "yandex_disk": {
      const creds = Buffer.from(
        `${process.env.YANDEX_CLIENT_ID}:${process.env.YANDEX_CLIENT_SECRET}`,
      ).toString("base64");
      return callTokenEndpoint(
        "https://oauth.yandex.com/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
        creds,
      );
    }

    // pCloud tokens are long-lived (no expiry) — no refresh endpoint exists.
    // amazon_photos is identity-only and not used for file sync.
    default:
      throw new Error(`Token refresh not supported for provider: ${provider}`);
  }
}

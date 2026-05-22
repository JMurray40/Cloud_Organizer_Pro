export interface SyncedFile {
  name: string;
  sizeBytes?: number;
}

const MAX_FILES = 5000;

const SUPPORTED = new Set(["google_drive", "dropbox", "onedrive", "box", "pcloud", "yandex_disk"]);

export function supportsSync(provider: string): boolean {
  return SUPPORTED.has(provider);
}

export async function listProviderFiles(provider: string, accessToken: string): Promise<SyncedFile[]> {
  switch (provider) {
    case "google_drive":  return listGoogleDriveFiles(accessToken);
    case "dropbox":       return listDropboxFiles(accessToken);
    case "onedrive":      return listOneDriveFiles(accessToken);
    case "box":           return listBoxFiles(accessToken);
    case "pcloud":        return listPcloudFiles(accessToken);
    case "yandex_disk":   return listYandexDiskFiles(accessToken);
    default: throw new Error(`File listing not supported for provider: ${provider}`);
  }
}

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

async function listGoogleDriveFiles(accessToken: string): Promise<SyncedFile[]> {
  const files: SyncedFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: "trashed=false and mimeType!='application/vnd.google-apps.folder'",
      fields: "files(name,size),nextPageToken",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google Drive API error: HTTP ${res.status}`);
    const data = await res.json() as {
      files: Array<{ name: string; size?: string }>;
      nextPageToken?: string;
    };
    for (const f of data.files) {
      files.push({ name: f.name, sizeBytes: f.size ? parseInt(f.size, 10) : undefined });
    }
    pageToken = data.nextPageToken;
  } while (pageToken && files.length < MAX_FILES);

  return files;
}

// ---------------------------------------------------------------------------
// Dropbox
// ---------------------------------------------------------------------------

async function listDropboxFiles(accessToken: string): Promise<SyncedFile[]> {
  const files: SyncedFile[] = [];
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const startRes = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "", recursive: true, include_deleted: false }),
  });
  if (!startRes.ok) throw new Error(`Dropbox API error: HTTP ${startRes.status}`);

  type DropboxData = { entries: Array<{ ".tag": string; name: string; size?: number }>; cursor: string; has_more: boolean };
  let data = await startRes.json() as DropboxData;

  const collect = (entries: DropboxData["entries"]) => {
    for (const e of entries) {
      if (e[".tag"] === "file") files.push({ name: e.name, sizeBytes: e.size });
    }
  };
  collect(data.entries);

  while (data.has_more && files.length < MAX_FILES) {
    const res = await fetch("https://api.dropboxapi.com/2/files/list_folder/continue", {
      method: "POST",
      headers,
      body: JSON.stringify({ cursor: data.cursor }),
    });
    if (!res.ok) throw new Error(`Dropbox continue error: HTTP ${res.status}`);
    data = await res.json() as DropboxData;
    collect(data.entries);
  }

  return files;
}

// ---------------------------------------------------------------------------
// OneDrive (Microsoft Graph — delta endpoint lists everything)
// ---------------------------------------------------------------------------

async function listOneDriveFiles(accessToken: string): Promise<SyncedFile[]> {
  const files: SyncedFile[] = [];
  let url: string | undefined =
    "https://graph.microsoft.com/v1.0/me/drive/root/delta?$select=name,file,folder,size,deleted";

  while (url && files.length < MAX_FILES) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`OneDrive API error: HTTP ${res.status}`);
    const data = await res.json() as {
      value: Array<{ name: string; file?: object; folder?: object; size?: number; deleted?: object }>;
      "@odata.nextLink"?: string;
    };
    for (const item of data.value) {
      if (item.file && !item.deleted) {
        files.push({ name: item.name, sizeBytes: item.size });
      }
    }
    url = data["@odata.nextLink"];
  }

  return files;
}

// ---------------------------------------------------------------------------
// Box (search API covers all files in the account)
// ---------------------------------------------------------------------------

async function listBoxFiles(accessToken: string): Promise<SyncedFile[]> {
  const files: SyncedFile[] = [];
  const limit = 1000;
  let offset = 0;

  while (files.length < MAX_FILES) {
    const params = new URLSearchParams({
      query: "*",
      type: "file",
      limit: String(limit),
      offset: String(offset),
      fields: "name,size",
    });
    const res = await fetch(`https://api.box.com/2.0/search?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Box API error: HTTP ${res.status}`);
    const data = await res.json() as { entries: Array<{ name: string; size?: number }>; total_count: number };
    for (const f of data.entries) {
      files.push({ name: f.name, sizeBytes: f.size });
    }
    if (data.entries.length === 0 || offset + limit >= data.total_count) break;
    offset += limit;
  }

  return files;
}

// ---------------------------------------------------------------------------
// pCloud (try US endpoint first, fall back to EU)
// ---------------------------------------------------------------------------

async function listPcloudFiles(accessToken: string): Promise<SyncedFile[]> {
  for (const base of ["https://api.pcloud.com", "https://eapi.pcloud.com"]) {
    const res = await fetch(`${base}/listfolder?folderid=0&recursive=1&showdeleted=0`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      if (base === "https://api.pcloud.com") continue;
      throw new Error(`pCloud API error: HTTP ${res.status}`);
    }
    const data = await res.json() as { result: number; metadata?: { contents?: unknown[] } };
    if (data.result !== 0) {
      if (base === "https://api.pcloud.com") continue;
      throw new Error(`pCloud error: result=${data.result}`);
    }
    return extractPcloudEntries(data.metadata?.contents ?? []);
  }
  throw new Error("pCloud: neither US nor EU endpoint responded successfully");
}

function extractPcloudEntries(contents: unknown[]): SyncedFile[] {
  const files: SyncedFile[] = [];
  for (const item of contents as Array<{ isfolder?: boolean; name?: string; size?: number; contents?: unknown[] }>) {
    if (item.isfolder) {
      if (item.contents) files.push(...extractPcloudEntries(item.contents));
    } else if (item.name) {
      files.push({ name: item.name, sizeBytes: item.size });
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Yandex Disk (uses "OAuth" not "Bearer")
// ---------------------------------------------------------------------------

async function listYandexDiskFiles(accessToken: string): Promise<SyncedFile[]> {
  const files: SyncedFile[] = [];
  const limit = 1000;
  let offset = 0;

  while (files.length < MAX_FILES) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      fields: "items.name,items.size,items.type,total",
    });
    const res = await fetch(`https://cloud-api.yandex.net/v1/disk/resources/files?${params}`, {
      headers: { Authorization: `OAuth ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Yandex Disk API error: HTTP ${res.status}`);
    const data = await res.json() as {
      items: Array<{ name: string; size?: number; type: string }>;
      total: number;
    };
    for (const item of data.items) {
      if (item.type === "file") files.push({ name: item.name, sizeBytes: item.size });
    }
    if (data.items.length === 0 || offset + limit >= data.total) break;
    offset += limit;
  }

  return files;
}

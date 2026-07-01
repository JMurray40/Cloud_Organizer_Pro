#!/usr/bin/env node
// Render cron job entry point — triggers background sync of all connected cloud accounts.
// Requires: API_BASE_URL, CRON_SECRET environment variables.

const apiBase = (process.env.API_BASE_URL ?? "").replace(/\/$/, "");
const secret = process.env.CRON_SECRET ?? "";

if (!apiBase || !secret) {
  console.error("[cron-sync] Missing API_BASE_URL or CRON_SECRET — aborting");
  process.exit(1);
}

try {
  const res = await fetch(`${apiBase}/api/internal/sync-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`[cron-sync] HTTP ${res.status}: ${body}`);
  process.exit(res.ok ? 0 : 1);
} catch (err) {
  console.error("[cron-sync] Request failed:", err);
  process.exit(1);
}

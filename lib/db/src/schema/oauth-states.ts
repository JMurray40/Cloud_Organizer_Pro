import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Short-lived OAuth state tokens. We persist them on /oauth/connect/:provider
 * and verify+delete them on /oauth/callback/:provider to prevent CSRF.
 * Entries expire after 10 minutes — clean up opportunistically on use.
 */
export const oauthStatesTable = pgTable(
  "oauth_states",
  {
    state: text("state").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("oauth_states_user_idx").on(t.userId)],
);

export type OAuthState = typeof oauthStatesTable.$inferSelect;

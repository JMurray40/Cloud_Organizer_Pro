import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { cloudAccountsTable } from "./cloud-accounts";

export const oauthTokensTable = pgTable(
  "oauth_tokens",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    cloudAccountId: integer("cloud_account_id").references(() => cloudAccountsTable.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("oauth_tokens_user_provider_idx").on(t.userId, t.provider),
    index("oauth_tokens_account_idx").on(t.cloudAccountId),
  ],
);

export type OAuthToken = typeof oauthTokensTable.$inferSelect;

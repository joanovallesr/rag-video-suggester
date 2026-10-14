import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { nextCookies } from "better-auth/next-js";

import { db } from "../../db/db";
import * as schema from "../../db/schema";
import { serverEnv } from "../../data/serverEnv";

const trustedOrigins = (serverEnv.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  secret: serverEnv.BETTER_AUTH_SECRET,
  baseURL: serverEnv.BETTER_AUTH_URL,
  trustedOrigins,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  socialProviders: {
    github: {
      clientId: serverEnv.GITHUB_CLIENT_ID,
      clientSecret: serverEnv.GITHUB_CLIENT_SECRET,
    },
  },

  // Session lifetime and freshness. Sensitive operations can require a fresh
  // session (see `freshAge`), and the cookie cache avoids a DB read per request.
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the session every 24 hours
    freshAge: 60 * 60, // a session is "fresh" for 1 hour
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
      strategy: "jwe", // encrypt the cached session (contains PII)
    },
  },

  account: {
    // Encrypt GitHub OAuth tokens at rest (AES-256-GCM, key derived from secret).
    encryptOAuthTokens: true,
    storeStateStrategy: "cookie",
  },

  rateLimit: {
    enabled: true,
    storage: "database", // survives restarts / works across serverless instances
    window: 10,
    max: 100,
    customRules: {
      // Social sign-in needs more headroom than the default 3/10s.
      "/sign-in/social": { window: 60, max: 10 },
      "/callback/*": { window: 60, max: 10 },
    },
  },

  advanced: {
    database: {
      generateId: "uuid",
    },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
      ipv6Subnet: 64,
    },
  },

  // Security audit trail. Hooks receive `(data, context)` positionally.
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          console.info("[auth] session.created", {
            userId: session.userId,
            ip: session.ipAddress ?? null,
          });
        },
      },
      delete: {
        before: async (session) => {
          console.info("[auth] session.revoked", { sessionId: session.id });
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          console.info("[auth] account.linked", {
            userId: account.userId,
            provider: account.providerId,
          });
        },
      },
    },
  },

  // Ensures cookies set inside Server Actions/Route Handlers are persisted by
  // Next.js.
  plugins: [nextCookies()],
});

import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const serverEnv = createEnv({
  server: {
    DATABASE_URL: z.url(),
    // Used to sign/encrypt sessions. Generate with: openssl rand -base64 32
    BETTER_AUTH_SECRET: z.string().min(32),
    // Public origin of the app, e.g. http://localhost:3000
    BETTER_AUTH_URL: z.url(),
    // GitHub OAuth app credentials
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    // Comma-separated list of extra allowed origins (optional)
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
    // OpenAI API key used to generate chunk embeddings
    OPENAI_API_KEY: z.string().min(1),
    // YouTube Data API v3 key used to discover uploads (public data, no OAuth)
    YOUTUBE_API_KEY: z.string().min(1),
    // Secret used by Vercel Cron to authenticate ingestion requests
    CRON_SECRET: z.string().min(1),
    // Search rate limiting: max searches per user within a rolling window.
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive(),
    RATE_LIMIT_WINDOW_HOURS: z.coerce.number().positive()
  },
  experimental__runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

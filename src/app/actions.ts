"use server";

import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import * as z from "zod";

import { db } from "../db/db";
import { rateLimit } from "../db/schemas/auth";
import { auth } from "../lib/auth/config";
import { searchContent } from "../lib/search/search";
import type { SearchActionResult } from "../lib/search/types";

const querySchema = z.string().trim().min(1).max(500);

const SEARCH_RATE_LIMIT_WINDOW_MS = 10_000;
const SEARCH_RATE_LIMIT_MAX = 20;

/**
 * Counts a search against the existing database-backed rate-limit table.
 * Returns an error message when the authenticated user has exceeded the
 * window, or null when the request may proceed.
 */
async function checkSearchRateLimit(userId: string): Promise<string | null> {
  const key = `search:${userId}`;
  const now = Date.now();
  const windowStart = now - SEARCH_RATE_LIMIT_WINDOW_MS;

  const [entry] = await db
    .insert(rateLimit)
    .values({ key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${rateLimit.lastRequest} <= ${windowStart} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${rateLimit.lastRequest} <= ${windowStart} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({
      count: rateLimit.count,
      lastRequest: rateLimit.lastRequest,
    });

  if (!entry || entry.count <= SEARCH_RATE_LIMIT_MAX) return null;

  const retryAfter = Math.max(
    1,
    Math.ceil((entry.lastRequest + SEARCH_RATE_LIMIT_WINDOW_MS - now) / 1000),
  );

  return `Too many searches. Please try again in ${retryAfter} second${
    retryAfter === 1 ? "" : "s"
  }.`;
}

/**
 * Server entry point for the search bar. Search is only available to signed-in
 * users, so the session and input are verified here rather than trusting the
 * client.
 */
export async function searchContentAction(
  query: string,
): Promise<SearchActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "You need to sign in to search." };
  }

  const parsed = querySchema.safeParse(query);
  if (!parsed.success) {
    return { error: "Enter a search query up to 500 characters." };
  }

  try {
    const rateLimitError = await checkSearchRateLimit(session.user.id);
    if (rateLimitError) {
      return { error: rateLimitError };
    }

    return { results: await searchContent(parsed.data) };
  } catch (error) {
    console.error("[search] failed", error);
    return { error: "Search failed. Please try again." };
  }
}

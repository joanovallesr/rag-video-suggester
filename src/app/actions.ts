"use server";

import { headers } from "next/headers";
import * as z from "zod";

import { serverEnv } from "../data/serverEnv";
import { auth } from "../lib/auth/config";
import {
  formatRateLimitError,
  getRateLimitWindowStart,
} from "../lib/search/rateLimit";
import { searchContent } from "../lib/search/search";
import {
  beginSearch,
  recordSearchResults,
} from "../lib/search/searchHistory";
import type { SearchActionResult } from "../lib/search/types";

const querySchema = z.string().trim().min(1).max(500);

/**
 * Server entry point for the search bar. Search is only available to signed-in
 * users, so the session and input are verified here rather than trusting the
 * client.
 *
 * Quota is enforced against the recorded search history in the database: the
 * previous `RATE_LIMIT_WINDOW_HOURS` hours are counted, and a query is recorded
 * before it runs so every accepted search counts toward future requests.
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

  const maxRequests = serverEnv.RATE_LIMIT_MAX_REQUESTS;
  const windowHours = serverEnv.RATE_LIMIT_WINDOW_HOURS;

  try {
    const windowStart = getRateLimitWindowStart(new Date(), windowHours);
    const searchId = await beginSearch({
      userId: session.user.id,
      queryText: parsed.data,
      since: windowStart,
      maxRequests,
    });

    if (!searchId) {
      return { error: formatRateLimitError(maxRequests, windowHours) };
    }

    const results = await searchContent(parsed.data);

    try {
      await recordSearchResults(
        session.user.id,
        searchId,
        results.map((result) => result.contentId),
      );
    } catch (error) {
      // The search is already counted; don't discard good results because the
      // history row could not be updated.
      console.error("[search] failed to record result ids", error);
    }

    return { results };
  } catch (error) {
    console.error("[search] failed", error);
    return { error: "Search failed. Please try again." };
  }
}

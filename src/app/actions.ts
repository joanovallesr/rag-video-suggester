"use server";

import { headers } from "next/headers";
import * as z from "zod";

import { auth } from "../lib/auth/config";
import { searchContent } from "../lib/search/search";
import type { SearchActionResult } from "../lib/search/types";

const querySchema = z.string().trim().min(1).max(500);

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
    return { results: await searchContent(parsed.data) };
  } catch (error) {
    console.error("[search] failed", error);
    return { error: "Search failed. Please try again." };
  }
}

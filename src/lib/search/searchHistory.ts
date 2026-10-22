import { and, eq, sql } from "drizzle-orm";

import { db } from "../../db/db";
import { searchQuery } from "../../db/schemas/searchQuery";

type BeginSearchInput = {
  userId: string;
  queryText: string;
  since: Date;
  maxRequests: number;
};

/**
 * Records a search if it fits inside the user's rolling quota.
 *
 * The quota check and insert happen in one statement rather than as separate
 * round-trips. Returns the new search id, or null when the quota is already
 * exhausted.
 */
export async function beginSearch(
  input: BeginSearchInput,
): Promise<string | null> {
  const result = await db.execute<{ id: string }>(sql`
    insert into ${searchQuery} ("query_text", "user_id")
    select ${input.queryText}, ${input.userId}::uuid
    where (
      select count(*)
      from ${searchQuery}
      where ${searchQuery.userId} = ${input.userId}::uuid
        and ${searchQuery.createdAt} >= ${input.since.toISOString()}::timestamptz
    ) < ${input.maxRequests}::int
    returning ${searchQuery.id}
  `);

  return result.rows[0]?.id ?? null;
}

/** Attaches the content ids returned by a search that has already been counted. */
export async function recordSearchResults(
  userId: string,
  searchId: string,
  resultContentIds: string[],
): Promise<void> {
  await db
    .update(searchQuery)
    .set({ resultContentIds })
    .where(
      and(eq(searchQuery.id, searchId), eq(searchQuery.userId, userId)),
    );
}

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
 * `neon-http` has no interactive transactions, so the per-user advisory lock,
 * quota check, and insert run as one `db.batch` transaction. Concurrent
 * requests for the same user serialize on the lock and the later statement sees
 * the previously committed rows.
 *
 * Returns the new search id, or null when the quota is already exhausted.
 */
export async function beginSearch(
  input: BeginSearchInput,
): Promise<string | null> {
  const userId = input.userId;
  const [, inserted] = await db.batch([
    // Lock per user for the lifetime of this transaction. The count below runs
    // in a separate statement, so it gets a fresh snapshot after the lock is
    // acquired.
    db.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}::text))`),
    db.execute<{ id: string }>(sql`
      insert into ${searchQuery} ("query_text", "user_id")
      select ${input.queryText}, ${userId}::uuid
      where (
        select count(*)
        from ${searchQuery}
        where ${searchQuery.userId} = ${userId}::uuid
          and ${searchQuery.createdAt} >= ${input.since.toISOString()}::timestamptz
      ) < ${input.maxRequests}::int
      returning ${searchQuery.id}
    `),
  ]);

  return inserted.rows[0]?.id ?? null;
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

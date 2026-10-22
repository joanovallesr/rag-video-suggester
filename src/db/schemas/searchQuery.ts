import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

// A search made by a signed-in user. Recorded so search history can be shown
// and so rate limits are enforced against actual usage.
export const searchQuery = pgTable(
  "search_query",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    queryText: text("query_text").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // IDs of the content rows returned for this search, in no particular order.
    resultContentIds: uuid("result_content_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Supports counting a user's searches inside the rolling rate-limit window.
    index("search_query_userId_createdAt_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

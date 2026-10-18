import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { content } from "./content";

// A plain-text slice of a piece of content. Embeddings are populated by a
// separate process, so the vector column stays nullable for now.
export const chunk = pgTable(
  "chunk",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    // Only used for video chunks (caption start time); null for articles.
    startPosition: integer("start_position"),
    embedding: vector("embedding", { dimensions: 1536 }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("chunk_contentId_idx").on(table.contentId)],
);

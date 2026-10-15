import { defineRelationsPart, sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// The kind of source material a piece of content was ingested from.
export const contentTypeEnum = pgEnum("content_type", ["video", "article"]);

// A single ingested source item (a video or, for this ingestion, a blog article).
export const content = pgTable("content", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  publishDate: date("publish_date").notNull(),
  url: text("url").notNull().unique(),
  thumbnailUrl: text("thumbnail_url"),
  type: contentTypeEnum("type").notNull(),
  // Raw HTML of the article post body.
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

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
    embedding: vector("embedding", { dimensions: 768 }),
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

export const contentRelations = defineRelationsPart({ content, chunk }, (r) => ({
  content: {
    chunks: r.many.chunk({
      from: r.content.id,
      to: r.chunk.contentId,
    }),
  },
  chunk: {
    content: r.one.content({
      from: r.chunk.contentId,
      to: r.content.id,
    }),
  },
}));

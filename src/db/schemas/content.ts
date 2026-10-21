import { sql } from "drizzle-orm";
import {
  date,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
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
  // Raw source body: article post HTML, or the plain transcript for videos.
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

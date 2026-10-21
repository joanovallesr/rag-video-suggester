import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A video that will never be ingested, tracked so discovery can treat it as
 * known and stop paginating.
 *
 * Only terminal reasons are recorded. A video that is currently live or
 * upcoming must stay absent: it becomes an ingestible VOD later. Transient
 * failures stay absent too, so they are retried on the next run.
 */
export const skippedVideo = pgTable("skipped_video", {
  videoId: text("video_id").primaryKey(),
  reason: text("reason").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

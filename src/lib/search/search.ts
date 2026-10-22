import {
  asc,
  cosineDistance,
  eq,
  isNotNull,
  lte,
  sql,
} from "drizzle-orm";

import { db } from "../../db/db";
import { chunk } from "../../db/schemas/chunks";
import { content } from "../../db/schemas/content";
import { embedQuery } from "../embedding/embed-chunks";
import { MAX_DISTANCE, MAX_RESULTS, toSimilarity } from "./similarity";
import type { ContentSearchResult } from "./types";

/**
 * Embeds `query` and returns the closest pieces of content.
 *
 * Chunks are ranked by cosine distance, but only the best matching chunk for
 * each piece of content is kept. Results whose best chunk matches the query at
 * less than `MIN_SIMILARITY` are discarded, and at most `MAX_RESULTS` unique
 * pieces of content are returned.
 */
export async function searchContent(
  query: string,
): Promise<ContentSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const embedding = await embedQuery(trimmed);
  if (!embedding) return [];

  const distance = cosineDistance(chunk.embedding, embedding);

  // Order by distance in the inner query so pgvector can use an index and the
  // sort is bounded. The distance threshold and per-content deduplication are
  // applied in the outer query, over that limited set of candidates.
  const candidates = db
    .select({
      contentId: chunk.contentId,
      distance: sql<number>`${distance}`.as("distance"),
      startPosition: chunk.startPosition,
      text: chunk.text,
    })
    .from(chunk)
    .where(isNotNull(chunk.embedding))
    .orderBy(asc(distance))
    .limit(MAX_RESULTS * 10)
    .as("candidates");

  const bestChunks = db
    .select({
      contentId: candidates.contentId,
      distance: candidates.distance,
      startPosition: candidates.startPosition,
      text: candidates.text,
      rank: sql<number>`row_number() over (
        partition by ${candidates.contentId}
        order by ${candidates.distance}
      )`.as("rank"),
    })
    .from(candidates)
    .where(lte(candidates.distance, MAX_DISTANCE))
    .as("best_chunks");

  const rows = await db
    .select({
      contentId: content.id,
      title: content.title,
      description: content.description,
      thumbnailUrl: content.thumbnailUrl,
      url: content.url,
      publishDate: content.publishDate,
      type: content.type,
      distance: bestChunks.distance,
      startPosition: bestChunks.startPosition,
      text: bestChunks.text,
    })
    .from(bestChunks)
    .innerJoin(content, eq(content.id, bestChunks.contentId))
    .where(eq(bestChunks.rank, 1))
    .orderBy(asc(bestChunks.distance))
    .limit(MAX_RESULTS);

  return rows.map((row) => ({
    contentId: row.contentId,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl,
    url: row.url,
    publishDate: row.publishDate,
    type: row.type,
    similarity: toSimilarity(Number(row.distance)),
    startPosition: row.startPosition,
    text: row.text,
  }));
}

import type { content } from "../../db/schemas/content";

export type ContentType = typeof content.$inferSelect.type;

/**
 * A single piece of content matched by a search, together with the details of
 * its best-matching chunk.
 */
export type ContentSearchResult = {
  /** Database id of the matched content row. */
  contentId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  url: string;
  publishDate: string;
  type: ContentType;
  /** Cosine similarity of the best matching chunk, from 0 to 1. */
  similarity: number;
  startPosition: number | null;
  text: string;
};

export type SearchActionResult =
  | { results: ContentSearchResult[] }
  | { error: string };

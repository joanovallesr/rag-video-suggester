/** Only chunks matching the query at least this well are returned. */
export const MIN_SIMILARITY = 0.5;

/** The cosine distance equivalent of `MIN_SIMILARITY`. */
export const MAX_DISTANCE = 1 - MIN_SIMILARITY;

/** The maximum number of unique pieces of content a search returns. */
export const MAX_RESULTS = 20;

/**
 * pgvector's cosine distance is `1 - cosine similarity`, so converting it back
 * gives a familiar 100% = identical score. Non-finite values never match.
 */
export function toSimilarity(distance: number): number {
  if (!Number.isFinite(distance)) return 0;

  const similarity = 1 - distance;
  if (similarity < 0) return 0;
  if (similarity > 1) return 1;

  return similarity;
}

/** Formats a 0..1 similarity as a rounded percentage, e.g. "69% match". */
export function formatMatchPercent(similarity: number): string {
  const percent = Math.round(Math.min(1, Math.max(0, similarity)) * 100);
  return `${percent}% match`;
}

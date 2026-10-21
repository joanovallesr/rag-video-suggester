import type { ContentType } from "./types";

/**
 * Build the URL a search result should open. Video results deep-link to the
 * matching moment; everything else opens at the top.
 *
 * The canonical video URL already has a query string (`?v=<id>`), so the
 * timestamp must be set through `URLSearchParams` — string-concatenating
 * `?t=` would corrupt the video id.
 */
export function buildResultUrl(
  url: string,
  type: ContentType,
  startPosition: number | null,
): string {
  if (type !== "video" || startPosition === null) return url;
  if (!Number.isFinite(startPosition) || startPosition < 0) return url;

  try {
    const result = new URL(url);
    result.searchParams.set("t", String(Math.floor(startPosition)));
    return result.toString();
  } catch {
    return url;
  }
}

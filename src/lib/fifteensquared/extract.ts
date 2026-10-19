import { load, type CheerioAPI } from "cheerio";
import type { ExtractedArticle } from "./types";

// A `Cheerio` selection whose node type we don't care about.
type AnyCheerio = ReturnType<CheerioAPI>;

const POST_BODY_SELECTORS = [
  "article .entry-content",
  ".entry-content",
  "article",
];

/**
 * Parse a single article page and pull out the post body and a thumbnail.
 * The body is returned as raw HTML; chunking happens separately in
 * `chunkArticles`.
 */
export function extractArticle(html: string, articleUrl: string): ExtractedArticle {
  const $ = load(html);

  const $body = selectPostBody($);
  // The "jump to content" anchor WordPress injects carries no text.
  $body.find("span[id^='more-']").remove();

  return {
    contentHtml: $body.html() ?? "",
    thumbnailUrl: resolveThumbnail($, $body, articleUrl),
  };
}

function selectPostBody($: CheerioAPI): AnyCheerio {
  for (const selector of POST_BODY_SELECTORS) {
    const $candidate = $(selector).first();
    if ($candidate.length > 0) return $candidate;
  }
  return $("body");
}

/**
 * Prefer the OG image; fall back to the first image in the body; otherwise
 * return null.
 */
function resolveThumbnail(
  $: CheerioAPI,
  $body: AnyCheerio,
  articleUrl: string,
): string | null {
  const ogImage = firstUsableImageUrl([
    $('meta[property="og:image"]').attr("content"),
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('meta[name="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
  ]);
  if (ogImage) return absolutizeUrl(ogImage, articleUrl);

  const $img = $body.find("img").first();
  const bodyImage = firstUsableImageUrl([
    $img.attr("src"),
    $img.attr("data-src"),
    $img.attr("data-lazy-src"),
    $img.attr("data-original"),
  ]);
  return bodyImage ? absolutizeUrl(bodyImage, articleUrl) : null;
}

function firstUsableImageUrl(candidates: (string | undefined)[]): string | null {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && !value.startsWith("data:")) return value;
  }
  return null;
}

function absolutizeUrl(raw: string, base: string): string | null {
  try {
    return new URL(raw, base).href;
  } catch {
    return null;
  }
}

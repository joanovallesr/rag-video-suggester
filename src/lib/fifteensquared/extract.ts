import { load, type CheerioAPI } from "cheerio";
import type { ExtractedArticle } from "./types";

// ---------------------------------------------------------------------------
// Structural DOM types
// ---------------------------------------------------------------------------
// Cheerio wraps htmlparser2/domhandler nodes. These shapes describe only the
// fields this module reads, which keeps it free of a direct dependency on the
// domhandler type package.
interface DomNode {
  type: string;
  data?: string;
  name?: string;
  children?: DomNode[];
  tagName?: string;
  attribs?: Record<string, string>;
}

// A `Cheerio` selection whose node type we don't care about.
type AnyCheerio = ReturnType<CheerioAPI>;

// ---------------------------------------------------------------------------
// DOM inspection notes (Fifteensquared runs WordPress with the GeneratePress
// theme):
//   * The post body lives in `.entry-content`, nested inside `<article>`.
//   * Section titles are *not* consistently `<h2>`. Across the archive they
//     appear as `<div class="fts-group">`, `<td class="fts-group">`,
//     `<th>`, `<strong>`/`<b>`, and, on a handful of posts, an actual `<h2>`.
//     We therefore treat both real headings and standalone "Across"/"Down"
//     labels as chunk boundaries.
// ---------------------------------------------------------------------------
const POST_BODY_SELECTORS = [
  "article .entry-content",
  ".entry-content",
  "article",
];

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const SECTION_LABELS = new Set(["across", "down"]);

// Block-level tags get newline separators so text from adjacent blocks isn't
// glued together when we read the flattened text.
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "br", "dd", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4",
  "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

const TEXT_NODE_TYPES = new Set(["text", "cdata"]);

/**
 * Parse a single article page and pull out the post body, a thumbnail, and the
 * body chunked on its section headings.
 */
export function extractArticle(html: string, articleUrl: string): ExtractedArticle {
  const $ = load(html);

  const $body = selectPostBody($);
  // The "jump to content" anchor WordPress injects carries no text.
  $body.find("span[id^='more-']").remove();

  return {
    contentHtml: $body.html() ?? "",
    thumbnailUrl: resolveThumbnail($, $body, articleUrl),
    chunks: chunkPostBody($body),
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

/**
 * Split the post body into plain-text chunks on its section headings. Text
 * before the first heading becomes its own chunk.
 */
function chunkPostBody($body: AnyCheerio): string[] {
  const root = $body.get(0) as unknown as DomNode | undefined;
  if (!root) return [];

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const text = cleanChunk(current);
    if (text) chunks.push(text);
    current = "";
  };

  const walk = (node: DomNode) => {
    for (const child of node.children ?? []) {
      if (TEXT_NODE_TYPES.has(child.type)) {
        current += child.data ?? "";
        continue;
      }
      if (child.type === "script" || child.type === "style") continue;
      if (child.type !== "tag" && child.type !== "root") continue;

      if (isSectionHeading(child)) {
        // Close the previous chunk, then start the next one with the heading
        // text as its first line.
        flush();
        current = `${cleanChunk(nodeText(child))}\n`;
        continue;
      }

      const tag = (child.name ?? child.tagName ?? "").toLowerCase();
      const block = BLOCK_TAGS.has(tag);
      if (block) current += "\n";
      walk(child);
      if (block) current += "\n";
    }
  };

  walk(root);
  flush();
  return chunks;
}

function isSectionHeading(node: DomNode): boolean {
  const tag = (node.name ?? node.tagName ?? "").toLowerCase();
  if (HEADING_TAGS.has(tag)) return true;
  // A container whose entire text is an "Across"/"Down"-style label (e.g.
  // `<div class="fts-group">Across</div>` or `<th>Down</th>`) also marks a
  // section. Nested clue wrappers contain far more text and won't match.
  return SECTION_LABELS.has(cleanChunk(nodeText(node)).toLowerCase());
}

function nodeText(node: DomNode): string {
  if (TEXT_NODE_TYPES.has(node.type)) return node.data ?? "";
  let text = "";
  for (const child of node.children ?? []) text += nodeText(child);
  return text;
}

/** Collapse insignificant whitespace while preserving single line breaks. */
export function cleanChunk(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
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

import { load } from "cheerio";
import { cleanChunk } from "./cleanChunk";

export { cleanChunk } from "./cleanChunk";

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

// ---------------------------------------------------------------------------
// DOM inspection notes (Fifteensquared runs WordPress with the GeneratePress
// theme):
//   * Section titles are *not* consistently `<h2>`. Across the archive they
//     appear as `<div class="fts-group">`, `<td class="fts-group">`,
//     `<th>`, `<strong>`/`<b>`, and, on a handful of posts, an actual `<h2>`.
//     We therefore treat both real headings and standalone "Across"/"Down"
//     labels as chunk boundaries.
// ---------------------------------------------------------------------------
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
 * Split an article's post-body HTML into plain-text chunks on its section
 * headings. Text before the first heading becomes its own chunk.
 */
export function chunkArticles(html: string): string[] {
  const $ = load(html, null, false);
  const root = $.root().get(0) as unknown as DomNode | undefined;
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


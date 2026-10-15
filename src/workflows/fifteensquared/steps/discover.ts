import { db } from "../../../db/db";
import { content } from "../../../db/schema";
import { feedPageUrl, parseFeedPage } from "../../../lib/fifteensquared/feed";
import { fetchText } from "../../../lib/fifteensquared/http";
import type { ArticleRef } from "../../../lib/fifteensquared/types";

// The archive is large (~26k posts, ~2.7k feed pages). This cap is only a guard
// against a misbehaving feed paginating forever.
const MAX_FEED_PAGES = 10_000;

export type DiscoverOptions = {
  // Stop after this many feed pages. Defaults to walking the whole archive.
  maxFeedPages?: number;
};

/**
 * Walk the full paginated RSS archive and return every article that is not
 * already stored in the `content` table.
 */
export async function discoverNewArticles(
  options: DiscoverOptions = {},
): Promise<ArticleRef[]> {
  "use step";

  const pageLimit = Math.min(options.maxFeedPages ?? MAX_FEED_PAGES, MAX_FEED_PAGES);

  const existingRows = await db.select({ url: content.url }).from(content);
  const existingUrls = new Set(existingRows.map((row) => row.url));

  const discovered = new Map<string, ArticleRef>();

  for (let page = 1; page <= pageLimit; page += 1) {
    const xml = await fetchText(feedPageUrl(page));
    const items = parseFeedPage(xml);

    // An empty page means we've walked past the end of the archive.
    if (items.length === 0) break;

    for (const item of items) {
      if (existingUrls.has(item.url) || discovered.has(item.url)) continue;
      discovered.set(item.url, item);
    }
  }

  return [...discovered.values()];
}

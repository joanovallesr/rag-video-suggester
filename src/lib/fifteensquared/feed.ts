import { load } from "cheerio";
import type { ArticleRef } from "./types";

export const FIFTEENSQUARED_ORIGIN = "https://fifteensquared.net";
export const FIFTEENSQUARED_FEED_URL = `${FIFTEENSQUARED_ORIGIN}/feed/`;

// WordPress paginates the RSS 2.0 feed 10 items at a time via `?paged=N`.
export function feedPageUrl(page: number): string {
  return page <= 1
    ? FIFTEENSQUARED_FEED_URL
    : `${FIFTEENSQUARED_FEED_URL}?paged=${page}`;
}

/**
 * Parse one page of the RSS feed into article references. Returns an empty
 * array once the pagination runs past the end of the archive.
 */
export function parseFeedPage(xml: string): ArticleRef[] {
  const $ = load(xml, { xml: true });
  const articles: ArticleRef[] = [];

  $("item").each((_, item) => {
    const $item = $(item);
    const url = $item.find("link").first().text().trim();
    if (!url) return;

    articles.push({
      url,
      title: collapseWhitespace($item.find("title").first().text()),
      description: htmlToText($item.find("description").first().text()),
      publishDate: toIsoDate($item.find("pubDate").first().text().trim()),
    });
  });

  return articles;
}

/** Convert the RSS `<description>` fragments into clean, plain text. */
export function htmlToText(html: string): string {
  if (!html) return "";
  const $ = load(html);
  const text = $.root()
    .text()
    .replace(/read more\s*(»|>>|…)?/gi, " ")
    .replace(/continue reading[\s\S]*$/i, " ");
  return collapseWhitespace(text);
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function toIsoDate(raw: string): string {
  const date = new Date(raw);
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return safe.toISOString().slice(0, 10);
}

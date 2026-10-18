import { eq } from "drizzle-orm";
import Parser from "rss-parser";
import * as z from "zod";
import { FatalError } from "workflow";
import { db } from "../db/db";
import { content } from "../db/schemas/content";
import { chunk } from "../db/schemas/chunks";
import { extractArticle } from "../lib/fifteensquared/extract";
import { chunkArticles } from "../lib/chunking/chunkArticles";
import { batchExec } from "./utils/batchExec";
import { embedChunks } from "../lib/embedding/embed-chunks";

const RSS_URL = "https://fifteensquared.net/feed/";

const feedItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  link: z.url(),
  pubDate: z.coerce.date(),
});

export async function ingestBlogArticlesWorkflow() {
  "use workflow";

  const newArticles = await getNewArticlesFromRssFeed();
  return await batchExec(newArticles, ingestArticleStep);
}

async function getNewArticlesFromRssFeed() {
  "use step";

  const parser = new Parser({ customFields: { item: ["description"] } });
  const { items } = await parser.parseURL(RSS_URL);

  const existingRows = await db
    .select({ url: content.url })
    .from(content)
    .where(eq(content.type, "article"));
  const existingUrls = existingRows.map((row) => row.url);

  return items.filter(
    (item) => item.link && !existingUrls.includes(item.link),
  );
}

async function ingestArticleStep(feedItem: Parser.Item) {
  "use step";

  const { error, data: item } = feedItemSchema.safeParse(feedItem);
  if (error) {
    throw new FatalError(
      `Failed to process RSS feed item ${feedItem.link} - ${error.message}`,
    );
  }

  const response = await fetch(item.link);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${item.link}: ${response.status}`);
  }
  const html = await response.text();

  const { contentHtml, thumbnailUrl } = extractArticle(html, item.link);

  if (!contentHtml) {
    throw new FatalError(`Failed to extract article HTML ${item.link}`);
  }

  const chunks = chunkArticles(contentHtml);
  const embeddings = await embedChunks(chunks);

  const contentId = crypto.randomUUID();
  const contentValues = {
    id: contentId,
    type: "article" as const,
    title: item.title,
    description: item.description,
    publishDate: item.pubDate.toISOString().slice(0, 10),
    url: item.link,
    thumbnailUrl,
    content: contentHtml,
  };

  if (chunks.length > 0) {
    try {
      const [[contentRow]] = await db.batch([
        db
          .insert(content)
          .values(contentValues)
          .onConflictDoNothing()
          .returning({ id: content.id }),
        db.insert(chunk).values(
          chunks.map((text, i) => ({
            contentId,
            startPosition: null,
            embedding: embeddings[i],
            text: text,
          })),
        ),
      ] as const);

      if (contentRow?.id == null) {
        throw new FatalError(
          `Duplicate detected and failed to insert - ${item.link}`,
        );
      }
    } catch (error) {
      if (error instanceof FatalError) throw error;

      // A duplicate URL makes the content insert a no-op, so the chunk insert
      // fails its foreign key and rolls back the batch. Report that as a
      // duplicate instead of retrying the step.
      const [existingContent] = await db
        .select({ id: content.id })
        .from(content)
        .where(eq(content.url, item.link))
        .limit(1);

      if (existingContent) {
        throw new FatalError(
          `Duplicate detected and failed to insert - ${item.link}`,
        );
      }

      throw error;
    }
  } else {
    const [contentRow] = await db
      .insert(content)
      .values(contentValues)
      .onConflictDoNothing()
      .returning({ id: content.id });

    if (contentRow?.id == null) {
      throw new FatalError(
        `Duplicate detected and failed to insert - ${item.link}`,
      );
    }
  }
}

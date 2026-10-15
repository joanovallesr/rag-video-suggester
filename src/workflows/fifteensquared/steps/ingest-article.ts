import { db } from "../../../db/db";
import { chunk, content } from "../../../db/schema";
import { extractArticle } from "../../../lib/fifteensquared/extract";
import { fetchText } from "../../../lib/fifteensquared/http";
import type { ArticleRef } from "../../../lib/fifteensquared/types";

export type IngestArticleResult = {
  url: string;
  status: "ingested" | "skipped";
  chunkCount: number;
};

/**
 * Fetch one article, extract its post body + thumbnail, chunk the body on its
 * section headings, and persist the content row plus its chunks.
 *
 * No embeddings are produced here; that is a separate, later task.
 */
export async function ingestArticle(ref: ArticleRef): Promise<IngestArticleResult> {
  "use step";

  const html = await fetchText(ref.url);
  const { contentHtml, thumbnailUrl, chunks } = extractArticle(html, ref.url);

  const inserted = await db
    .insert(content)
    .values({
      title: ref.title,
      description: ref.description,
      publishDate: ref.publishDate,
      url: ref.url,
      thumbnailUrl,
      type: "article",
      content: contentHtml,
    })
    .onConflictDoNothing({ target: content.url })
    .returning({ id: content.id });

  const row = inserted.at(0);
  if (!row) {
    // A previous run already ingested this URL; nothing more to do.
    return { url: ref.url, status: "skipped", chunkCount: 0 };
  }

  if (chunks.length > 0) {
    await db.insert(chunk).values(
      chunks.map((text) => ({
        contentId: row.id,
        startPosition: null,
        text,
      })),
    );
  }

  return { url: ref.url, status: "ingested", chunkCount: chunks.length };
}

// Network hiccups are common; retry a few times before failing the step.
ingestArticle.maxRetries = 3;

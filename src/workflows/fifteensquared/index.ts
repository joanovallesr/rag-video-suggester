import { discoverNewArticles } from "./steps/discover";
import { ingestArticle } from "./steps/ingest-article";

// Requests are dispatched in batches of 10 to avoid hammering the server.
const BATCH_SIZE = 10;

export type IngestFifteensquaredOptions = {
  // Optional cap, handy for smoke-testing a run without touching the archive.
  maxArticles?: number;
  // Stop discovery after this many RSS pages. Defaults to the whole archive.
  maxFeedPages?: number;
};

export type IngestFifteensquaredSummary = {
  discovered: number;
  processed: number;
  ingested: number;
  skipped: number;
  chunkCount: number;
};

/**
 * Two-step ingestion workflow:
 *   1. `discoverNewArticles` walks the paginated RSS archive and returns every
 *      article not yet in the database.
 *   2. `ingestArticle` fetches, extracts, chunks and stores each one. The
 *      workflow fans these steps out 10 at a time.
 */
export async function ingestFifteensquaredWorkflow(
  options: IngestFifteensquaredOptions = {},
): Promise<IngestFifteensquaredSummary> {
  "use workflow";

  const discovered = await discoverNewArticles({
    maxFeedPages: options.maxFeedPages,
  });
  const articles = options.maxArticles
    ? discovered.slice(0, options.maxArticles)
    : discovered;

  const summary: IngestFifteensquaredSummary = {
    discovered: discovered.length,
    processed: 0,
    ingested: 0,
    skipped: 0,
    chunkCount: 0,
  };

  for (let index = 0; index < articles.length; index += BATCH_SIZE) {
    const batch = articles.slice(index, index + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((article) => ingestArticle(article)),
    );

    for (const result of results) {
      summary.processed += 1;
      summary.chunkCount += result.chunkCount;
      if (result.status === "ingested") summary.ingested += 1;
      else summary.skipped += 1;
    }
  }

  return summary;
}

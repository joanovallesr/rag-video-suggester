import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { ingestBlogArticlesWorkflow } from "../../../../workflows/ingestBlogArticles";

/**
 * Trigger the Fifteensquared blog-article ingestion workflow. The workflow
 * discovers new articles from the RSS feed and ingests each one.
 */
export async function POST() {
  const run = await start(ingestBlogArticlesWorkflow, []);

  return NextResponse.json({ runId: run.runId }, { status: 202 });
}

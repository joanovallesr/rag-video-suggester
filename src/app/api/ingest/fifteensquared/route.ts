import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { serverEnv } from "../../../../data/serverEnv";
import { ingestBlogArticlesWorkflow } from "../../../../workflows/ingestBlogArticles";

/**
 * Trigger the Fifteensquared blog-article ingestion workflow. The workflow
 * discovers new articles from the RSS feed and ingests each one.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${serverEnv.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await start(ingestBlogArticlesWorkflow, []);

  return NextResponse.json({ runId: run.runId }, { status: 202 });
}

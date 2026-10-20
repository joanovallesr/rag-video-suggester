import { NextRequest } from "next/server";
import { verifyAndRunCron } from "@/src/workflows/utils/verifyAndRunCron";
import { ingestBlogArticlesWorkflow } from "../../../../workflows/ingestBlogArticles";

/**
 * Trigger the Fifteensquared blog-article ingestion workflow. The workflow
 * discovers new articles from the RSS feed and ingests each one.
 */
export async function GET(request: NextRequest) {
  return await verifyAndRunCron(request, ingestBlogArticlesWorkflow);
}

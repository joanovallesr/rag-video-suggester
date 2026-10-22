import { NextRequest } from "next/server";
import { verifyAndRunCron } from "@/src/workflows/utils/verifyAndRunCron";
import { ingestVideosWorkflow } from "../../../../workflows/ingestVideos";

/**
 * Trigger the YouTube video ingestion workflow. The workflow discovers new
 * uploads on the Cracking the Cryptic channel and ingests each one.
 */
export async function GET(request: NextRequest) {
  return await verifyAndRunCron(request, ingestVideosWorkflow);
}

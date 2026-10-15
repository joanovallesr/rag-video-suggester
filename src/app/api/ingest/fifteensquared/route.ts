import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  ingestFifteensquaredWorkflow,
  type IngestFifteensquaredOptions,
} from "../../../../workflows/fifteensquared";

/**
 * Trigger the Fifteensquared ingestion workflow. Accepts an optional
 * `{ "maxArticles": number }` body to cap a run for smoke-testing.
 */
export async function POST(request: Request) {
  let options: IngestFifteensquaredOptions = {};

  if (request.headers.get("content-type")?.includes("application/json")) {
    options = (await request.json().catch(() => ({}))) as IngestFifteensquaredOptions;
  }

  const run = await start(ingestFifteensquaredWorkflow, [options]);

  return NextResponse.json({ runId: run.runId }, { status: 202 });
}

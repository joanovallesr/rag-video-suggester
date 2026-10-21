import { eq } from "drizzle-orm";
import { FatalError } from "workflow";
import { db } from "../db/db";
import { chunk } from "../db/schemas/chunks";
import { content } from "../db/schemas/content";
import { skippedVideo } from "../db/schemas/skippedVideo";
import { chunkCaptions } from "../lib/chunking/chunkCaptions";
import { embedChunks } from "../lib/embedding/embed-chunks";
import { getYouTubeClient } from "../lib/youtube/client";
import { discoverUploads } from "../lib/youtube/discovery";
import { getCaptionCues } from "../lib/youtube/transcript";
import type {
  SkipReason,
  SkippedVideo,
  VideoCandidate,
} from "../lib/youtube/types";
import { videoIdFromUrl } from "../lib/youtube/video";
import { batchExec } from "./utils/batchExec";

/**
 * Expected per-video outcomes are returned rather than thrown: custom error
 * classes lose their identity across the workflow step boundary, so a
 * "blocked" result could not be detected from a rejected promise.
 */
export type IngestOutcome =
  | { status: "ingested" }
  | { status: "skipped"; reason: SkipReason }
  | { status: "blocked" };

export async function ingestVideosWorkflow() {
  "use workflow";

  const { candidates, skipped } = await discoverNewVideos();

  if (skipped.length > 0) {
    await recordSkippedVideos(skipped);
  }

  return await batchExec(candidates, ingestVideoStep, {
    batchSize: 10,
    delayMs: 1_500,
    isSkipped: (outcome) => outcome.status === "skipped",
    shouldStop: (outcome) => outcome.status === "blocked",
  });
}

async function discoverNewVideos() {
  "use step";

  const [ingestedRows, skippedRows] = await Promise.all([
    db
      .select({ url: content.url })
      .from(content)
      .where(eq(content.type, "video")),
    db.select({ videoId: skippedVideo.videoId }).from(skippedVideo),
  ]);

  const knownVideoIds = new Set<string>(
    skippedRows.map((row) => row.videoId),
  );

  for (const row of ingestedRows) {
    const videoId = videoIdFromUrl(row.url);
    if (videoId) knownVideoIds.add(videoId);
  }

  return await discoverUploads(getYouTubeClient(), knownVideoIds);
}

async function recordSkippedVideos(videos: SkippedVideo[]) {
  "use step";

  await db
    .insert(skippedVideo)
    .values(
      videos.map((video) => ({
        videoId: video.videoId,
        reason: video.reason,
      })),
    )
    .onConflictDoNothing();
}

async function recordSkippedVideo(videoId: string, reason: SkipReason) {
  await db
    .insert(skippedVideo)
    .values({ videoId, reason })
    .onConflictDoNothing();
}

async function ingestVideoStep(video: VideoCandidate): Promise<IngestOutcome> {
  "use step";

  const transcript = await getCaptionCues(video.videoId);

  if (transcript.status === "blocked") {
    return { status: "blocked" };
  }

  if (transcript.status !== "ok") {
    await recordSkippedVideo(video.videoId, transcript.status);
    return { status: "skipped", reason: transcript.status };
  }

  const chunks = chunkCaptions(transcript.cues);

  if (chunks.length === 0) {
    await recordSkippedVideo(video.videoId, "zero_chunks");
    return { status: "skipped", reason: "zero_chunks" };
  }

  const embeddings = await embedChunks(chunks.map((value) => value.text));

  const contentId = crypto.randomUUID();
  const contentValues = {
    id: contentId,
    type: "video" as const,
    title: video.title,
    description: video.description,
    publishDate: video.publishedAt.slice(0, 10),
    url: video.url,
    thumbnailUrl: video.thumbnailUrl,
    // Chunks are non-overlapping, so joining them reconstructs the transcript
    // without the rolling duplicates removed by the chunker.
    content: chunks.map((value) => value.text).join("\n\n"),
  };

  try {
    const [[contentRow]] = await db.batch([
      db
        .insert(content)
        .values(contentValues)
        .onConflictDoNothing()
        .returning({ id: content.id }),
      db.insert(chunk).values(
        chunks.map((value, i) => ({
          contentId,
          startPosition: value.startPosition,
          embedding: embeddings[i],
          text: value.text,
        })),
      ),
    ] as const);

    if (contentRow?.id == null) {
      throw new FatalError(
        `Duplicate detected and failed to insert - ${video.url}`,
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
      .where(eq(content.url, video.url))
      .limit(1);

    if (existingContent) {
      throw new FatalError(
        `Duplicate detected and failed to insert - ${video.url}`,
      );
    }

    throw error;
  }

  return { status: "ingested" };
}

import type { youtube_v3 } from "googleapis";
import type { SkipReason, VideoCandidate } from "./types";

/** Shorter uploads are treated as shorts and kept out of the corpus. */
export const MIN_VIDEO_SECONDS = 60;

/**
 * How long a video without captions stays retryable. Auto-captions are often
 * generated after the upload appears, so ledgering "no captions" immediately
 * would make the video permanently invisible to discovery.
 */
export const CAPTION_GRACE_MS = 48 * 60 * 60 * 1_000;

export function shouldDeferSkip(
  reason: SkipReason,
  publishedAt: string,
  now: number,
): boolean {
  if (reason !== "no_captions") return false;

  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return false;

  return now - published < CAPTION_GRACE_MS;
}

const ISO_DURATION =
  /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

export type VideoClassification =
  | { status: "candidate"; video: VideoCandidate }
  | { status: "skip"; videoId: string; reason: SkipReason }
  /** Live/upcoming or unusable entries: not ingested and never ledgered. */
  | { status: "ignore" };

export function getPlaylistItemVideoId(
  item: youtube_v3.Schema$PlaylistItem,
): string | null {
  return (
    item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? null
  );
}

/** Parse an ISO 8601 video duration such as `PT1H2M3S` into seconds. */
export function parseIsoDuration(
  value: string | null | undefined,
): number | null {
  if (!value) return null;

  const match = ISO_DURATION.exec(value);
  if (!match) return null;

  const [, days, hours, minutes, seconds] = match;
  if (!days && !hours && !minutes && !seconds) return null;

  return (
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  );
}

export function pickThumbnail(
  thumbnails: youtube_v3.Schema$ThumbnailDetails | null | undefined,
): string | null {
  if (!thumbnails) return null;

  for (const size of ["maxres", "standard", "high", "medium", "default"] as const) {
    const url = thumbnails[size]?.url;
    if (url) return url;
  }

  return null;
}

export function buildVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function videoIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

/**
 * Decide what to do with one upload, given the playlist item and its
 * `videos.list` details (which may be missing if the video was removed).
 */
export function classifyVideo(
  item: youtube_v3.Schema$PlaylistItem,
  details: youtube_v3.Schema$Video | undefined,
): VideoClassification {
  const videoId = getPlaylistItemVideoId(item);
  if (!videoId) return { status: "ignore" };

  // Live and upcoming broadcasts appear in the uploads playlist before they
  // are watchable and become normal VODs later, so they must stay unknown.
  const liveStatus = details?.snippet?.liveBroadcastContent;
  if (liveStatus === "live" || liveStatus === "upcoming") {
    return { status: "ignore" };
  }

  if (!details?.snippet) {
    return { status: "skip", videoId, reason: "unavailable" };
  }

  const durationSeconds = parseIsoDuration(details.contentDetails?.duration);
  if (durationSeconds !== null && durationSeconds < MIN_VIDEO_SECONDS) {
    return { status: "skip", videoId, reason: "too_short" };
  }

  const title = details.snippet.title ?? item.snippet?.title;
  const publishedAt = details.snippet.publishedAt ?? item.snippet?.publishedAt;
  if (!title || !publishedAt) {
    return { status: "skip", videoId, reason: "unavailable" };
  }

  return {
    status: "candidate",
    video: {
      videoId,
      title,
      description:
        details.snippet.description ?? item.snippet?.description ?? "",
      publishedAt,
      url: buildVideoUrl(videoId),
      thumbnailUrl:
        pickThumbnail(details.snippet.thumbnails) ??
        pickThumbnail(item.snippet?.thumbnails),
      durationSeconds: durationSeconds ?? 0,
    },
  };
}

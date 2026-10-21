export const SKIP_REASONS = [
  "no_captions",
  "zero_chunks",
  "too_short",
  "unavailable",
] as const;

/**
 * Why a video will never be ingested. Every reason here is terminal, so it is
 * safe to record in the `skipped_video` ledger.
 */
export type SkipReason = (typeof SKIP_REASONS)[number];

/** A video that discovery selected for ingestion. */
export type VideoCandidate = {
  videoId: string;
  title: string;
  description: string;
  /** RFC 3339 publish timestamp from the YouTube API. */
  publishedAt: string;
  url: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
};

export type SkippedVideo = {
  videoId: string;
  reason: SkipReason;
};

export type DiscoveryResult = {
  candidates: VideoCandidate[];
  skipped: SkippedVideo[];
};

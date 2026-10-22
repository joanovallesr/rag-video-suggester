import {
  fetchTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";
import type { CaptionCue } from "../chunking/chunkCaptions";

export type TranscriptResult =
  | { status: "ok"; cues: CaptionCue[] }
  | { status: "no_captions" }
  | { status: "unavailable" }
  | { status: "blocked" };

export type RawCaptionCue = {
  text: string;
  duration: number;
  offset: number;
};

const PREFERRED_LANGUAGE = "en";
const MILLISECONDS = 1_000;
// Captions can trail the reported duration slightly.
const DURATION_TOLERANCE = 1.5;
const DURATION_SLACK_SECONDS = 60;
// Only used when discovery could not read a duration.
const FALLBACK_SECONDS_LIMIT = 24 * 60 * 60;
// Classic cues are short phrases measured in seconds; an srv3 cue duration is
// the same value in milliseconds. A median above this is strong evidence of
// milliseconds when the video duration cannot settle the unit.
const MAX_PLAUSIBLE_CUE_SECONDS = 60;

/**
 * Fetch a video's caption cues, preferring the English track. YouTube's
 * auto-translated tracks can sort ahead of the real one, so a missing `en`
 * track retries without a language filter instead of accepting a translation.
 */
export async function getCaptionCues(
  videoId: string,
  durationSeconds: number,
): Promise<TranscriptResult> {
  try {
    const cues = await fetchTranscript(videoId, { lang: PREFERRED_LANGUAGE });
    return { status: "ok", cues: toCues(cues, durationSeconds) };
  } catch (error) {
    if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
      try {
        const cues = await fetchTranscript(videoId);
        return { status: "ok", cues: toCues(cues, durationSeconds) };
      } catch (fallbackError) {
        return classify(fallbackError);
      }
    }

    return classify(error);
  }
}

/**
 * Normalize cue timings to seconds. `youtube-transcript` returns srv3 cues in
 * milliseconds but classic cues in seconds, so the unit is inferred by
 * comparing the last offset with the video's known duration. When the duration
 * is unknown, cue durations disambiguate short srv3 transcripts whose offsets
 * stay below the fallback limit.
 */
export function normalizeCaptionCues(
  cues: RawCaptionCue[],
  durationSeconds: number,
): CaptionCue[] {
  if (cues.length === 0) return [];

  const divisor = inferDivisor(cues, durationSeconds);

  return cues.map((cue) => ({
    text: cue.text,
    duration: cue.duration / divisor,
    offset: cue.offset / divisor,
  }));
}

/**
 * The last offset settles the unit when the duration is known. Without one,
 * cue durations are the best remaining signal: srv3 timings are whole
 * milliseconds, while classic timings are parsed as seconds and are usually
 * fractional.
 */
function inferDivisor(
  cues: RawCaptionCue[],
  durationSeconds: number,
): number {
  const maxOffset = Math.max(...cues.map((cue) => cue.offset));
  const upperBound =
    durationSeconds > 0
      ? durationSeconds * DURATION_TOLERANCE + DURATION_SLACK_SECONDS
      : FALLBACK_SECONDS_LIMIT;

  if (maxOffset > upperBound) return MILLISECONDS;
  if (durationSeconds > 0) return 1;

  // A fractional timing can only be classic seconds.
  if (
    cues.some(
      (cue) => !Number.isInteger(cue.offset) || !Number.isInteger(cue.duration),
    )
  ) {
    return 1;
  }

  const medianDuration = median(cues.map((cue) => cue.duration));
  return medianDuration > MAX_PLAUSIBLE_CUE_SECONDS ? MILLISECONDS : 1;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function toCues(
  cues: RawCaptionCue[],
  durationSeconds: number,
): CaptionCue[] {
  return normalizeCaptionCues(cues, durationSeconds);
}

function classify(error: unknown): TranscriptResult {
  if (error instanceof YoutubeTranscriptTooManyRequestError) {
    return { status: "blocked" };
  }

  if (error instanceof YoutubeTranscriptVideoUnavailableError) {
    return { status: "unavailable" };
  }

  if (
    error instanceof YoutubeTranscriptDisabledError ||
    error instanceof YoutubeTranscriptNotAvailableError ||
    error instanceof YoutubeTranscriptNotAvailableLanguageError
  ) {
    return { status: "no_captions" };
  }

  // Unknown failures stay retryable at the workflow level.
  throw error;
}

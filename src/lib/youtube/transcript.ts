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

const PREFERRED_LANGUAGE = "en";

/**
 * Fetch a video's caption cues, preferring the English track. YouTube's
 * auto-translated tracks can sort ahead of the real one, so a missing `en`
 * track retries without a language filter instead of accepting a translation.
 */
export async function getCaptionCues(videoId: string): Promise<TranscriptResult> {
  try {
    const cues = await fetchTranscript(videoId, { lang: PREFERRED_LANGUAGE });
    return { status: "ok", cues: toCues(cues) };
  } catch (error) {
    if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
      try {
        return { status: "ok", cues: toCues(await fetchTranscript(videoId)) };
      } catch (fallbackError) {
        return classify(fallbackError);
      }
    }

    return classify(error);
  }
}

function toCues(
  cues: { text: string; duration: number; offset: number }[],
): CaptionCue[] {
  return cues.map((cue) => ({
    text: cue.text,
    duration: cue.duration,
    offset: cue.offset,
  }));
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

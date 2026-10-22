import { cleanChunk } from "./cleanChunk";

/**
 * The parts of a caption cue this chunker needs. Matches the shape returned by
 * `youtube-transcript` without depending on it directly.
 */
export type CaptionCue = {
  text: string;
  /** Cue start time in seconds. */
  offset: number;
  /** Cue duration in seconds. */
  duration: number;
};

export type CaptionChunk = {
  text: string;
  /** Floored start time of the chunk's first cue, in seconds. */
  startPosition: number;
};

// Auto-captions split speech into 2-5 word cues, so these limits rebuild
// article-sized passages while keeping each chunk's start time meaningful.
const MAX_CHARS = 1_000;
const WINDOW_SECONDS = 60;
// A 60s window is only worth flushing once it carries enough text: long silent
// solving stretches would otherwise produce single-word chunks.
const MIN_CHARS_FOR_TIME_FLUSH = 200;
// A pause longer than this belongs to a different moment of the video, so a
// chunk never spans it and its start time stays honest.
const SILENCE_GAP_SECONDS = 20;

/**
 * Group caption cues into plain-text chunks, carrying the start time of each
 * chunk's first cue. This is the video analogue of `chunkArticles`: both split
 * on natural boundaries and produce non-overlapping plain text, but captions
 * have no headings, so time and silence provide the boundaries instead.
 */
export function chunkCaptions(cues: CaptionCue[]): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];

  let parts: string[] = [];
  let currentLength = 0;
  let start: number | null = null;
  let lastEnd: number | null = null;
  let previousText: string | null = null;

  const flush = () => {
    const text = cleanChunk(parts.join(" "));
    if (text) {
      chunks.push({ text, startPosition: Math.floor(start ?? 0) });
    }
    parts = [];
    currentLength = 0;
    start = null;
    lastEnd = null;
  };

  for (const cue of cues) {
    const text = cleanChunk(cue.text);
    if (!text) continue;
    if (!Number.isFinite(cue.offset) || cue.offset < 0) continue;

    // Auto-generated captions repeat the previous line in rolling-caption
    // mode. Those duplicates would otherwise dominate the embedding.
    if (text === previousText) continue;
    previousText = text;

    if (lastEnd !== null && cue.offset - lastEnd > SILENCE_GAP_SECONDS) {
      flush();
    }

    const elapsed = start === null ? 0 : cue.offset - start;
    const wouldExceed =
      parts.length > 0 && currentLength + 1 + text.length > MAX_CHARS;

    if (
      parts.length > 0 &&
      (wouldExceed ||
        (elapsed >= WINDOW_SECONDS &&
          currentLength >= MIN_CHARS_FOR_TIME_FLUSH))
    ) {
      flush();
    }

    start ??= cue.offset;
    parts.push(text);
    currentLength += parts.length === 1 ? text.length : 1 + text.length;

    const duration = Number.isFinite(cue.duration) ? cue.duration : 0;
    lastEnd = cue.offset + duration;

    if (currentLength >= MAX_CHARS) flush();
  }

  flush();
  return chunks;
}

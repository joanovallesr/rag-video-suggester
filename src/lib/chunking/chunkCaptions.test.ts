import { describe, expect, it } from "vitest";
import { chunkCaptions, type CaptionCue } from "./chunkCaptions";

function cue(text: string, offset: number, duration = 2): CaptionCue {
  return { text, offset, duration };
}

describe("chunkCaptions", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkCaptions([])).toEqual([]);
  });

  it("keeps a single cue and floors its start time", () => {
    expect(chunkCaptions([cue("hello world", 12.9, 3)])).toEqual([
      { text: "hello world", startPosition: 12 },
    ]);
  });

  it("merges short cues that fit inside the time window", () => {
    const chunks = chunkCaptions([
      cue("the puzzle", 0),
      cue("starts here", 2),
      cue("with a grid", 4),
    ]);

    expect(chunks).toEqual([
      { text: "the puzzle starts here with a grid", startPosition: 0 },
    ]);
  });

  it("flushes once the window has passed and enough text accumulated", () => {
    const long = (index: number) => `part ${index} `.padEnd(50, "a");
    const chunks = chunkCaptions([
      cue(long(1), 0, 10),
      cue(long(2), 10, 10),
      cue(long(3), 20, 10),
      cue(long(4), 30, 10),
      cue(long(5), 40, 10),
      cue("next moment", 60, 10),
    ]);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.startPosition).toBe(0);
    expect(chunks[1]).toEqual({ text: "next moment", startPosition: 60 });
  });

  it("does not flush a sparse 60s window", () => {
    // Gaps stay under the silence threshold, so only the 200-character
    // minimum keeps these short cues together past the 60s window.
    const chunks = chunkCaptions([
      cue("yes", 0, 2),
      cue("okay", 15, 2),
      cue("right", 30, 2),
      cue("good", 45, 2),
      cue("fine", 60, 2),
    ]);

    expect(chunks).toEqual([
      { text: "yes okay right good fine", startPosition: 0 },
    ]);
  });

  it("never exceeds the character budget", () => {
    const long = (index: number) => `part ${index} `.padEnd(200, "b");
    const chunks = chunkCaptions([
      cue(long(1), 0, 1),
      cue(long(2), 1, 1),
      cue(long(3), 2, 1),
      cue(long(4), 3, 1),
      cue(long(5), 4, 1),
      cue(long(6), 5, 1),
    ]);

    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(1_000);
    }
  });

  it("flushes across a long silence even when the window is short", () => {
    const chunks = chunkCaptions([
      cue("before the gap", 0, 2),
      cue("after the gap", 30, 2),
    ]);

    expect(chunks).toEqual([
      { text: "before the gap", startPosition: 0 },
      { text: "after the gap", startPosition: 30 },
    ]);
  });

  it("drops consecutive duplicate cues from rolling captions", () => {
    const chunks = chunkCaptions([
      cue("hello", 0),
      cue("hello", 2),
      cue("world", 4),
    ]);

    expect(chunks).toEqual([{ text: "hello world", startPosition: 0 }]);
  });

  it("ignores empty and malformed cues", () => {
    const chunks = chunkCaptions([
      cue("   ", 0),
      cue("kept", 1),
      { text: "bad offset", offset: Number.NaN, duration: 1 },
      { text: "negative offset", offset: -5, duration: 1 },
    ]);

    expect(chunks).toEqual([{ text: "kept", startPosition: 1 }]);
  });

  it("normalises internal whitespace", () => {
    const chunks = chunkCaptions([cue("hello    world", 0)]);

    expect(chunks).toEqual([{ text: "hello world", startPosition: 0 }]);
  });
});

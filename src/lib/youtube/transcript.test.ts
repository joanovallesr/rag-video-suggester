import { describe, expect, it } from "vitest";
import { normalizeCaptionCues } from "./transcript";

describe("normalizeCaptionCues", () => {
  it("converts srv3 millisecond cues to seconds", () => {
    // Real sample from a 47-minute Cracking the Cryptic video.
    expect(
      normalizeCaptionCues(
        [{ text: "hello", duration: 2_020, offset: 11_790 }],
        2_856,
      ),
    ).toEqual([{ text: "hello", duration: 2.02, offset: 11.79 }]);
  });

  it("preserves classic cues that are already in seconds", () => {
    expect(
      normalizeCaptionCues(
        [{ text: "hello", duration: 2.02, offset: 11.79 }],
        2_856,
      ),
    ).toEqual([{ text: "hello", duration: 2.02, offset: 11.79 }]);
  });

  it("returns no cues for empty input", () => {
    expect(normalizeCaptionCues([], 600)).toEqual([]);
  });

  it("detects milliseconds for a short video", () => {
    expect(
      normalizeCaptionCues([{ text: "hi", duration: 2_000, offset: 60_000 }], 60),
    ).toEqual([{ text: "hi", duration: 2, offset: 60 }]);
  });

  it("tolerates captions that trail the reported duration", () => {
    expect(
      normalizeCaptionCues([{ text: "outro", duration: 2, offset: 660 }], 600),
    ).toEqual([{ text: "outro", duration: 2, offset: 660 }]);
  });

  it("detects milliseconds for a short srv3 transcript when the duration is unknown", () => {
    expect(
      normalizeCaptionCues(
        [
          { text: "hi", duration: 1_200, offset: 5_000 },
          { text: "there", duration: 2_020, offset: 30_000 },
        ],
        0,
      ),
    ).toEqual([
      { text: "hi", duration: 1.2, offset: 5 },
      { text: "there", duration: 2.02, offset: 30 },
    ]);
  });

  it("keeps classic cues in seconds when the duration is unknown", () => {
    expect(
      normalizeCaptionCues(
        [
          { text: "hi", duration: 1.2, offset: 5 },
          { text: "there", duration: 2.02, offset: 30 },
        ],
        0,
      ),
    ).toEqual([
      { text: "hi", duration: 1.2, offset: 5 },
      { text: "there", duration: 2.02, offset: 30 },
    ]);
  });

  it("keeps classic cues in seconds when one cue is unusually long", () => {
    expect(
      normalizeCaptionCues(
        [
          { text: "intro", duration: 5, offset: 0 },
          { text: "music", duration: 90, offset: 300 },
        ],
        0,
      ),
    ).toEqual([
      { text: "intro", duration: 5, offset: 0 },
      { text: "music", duration: 90, offset: 300 },
    ]);
  });

  it("falls back to a 24-hour limit when the duration is unknown", () => {
    expect(
      normalizeCaptionCues(
        [{ text: "hi", duration: 2_020, offset: 2_856_487 }],
        0,
      ),
    ).toEqual([{ text: "hi", duration: 2.02, offset: 2_856.487 }]);

    expect(
      normalizeCaptionCues([{ text: "hi", duration: 2, offset: 3_600 }], 0),
    ).toEqual([{ text: "hi", duration: 2, offset: 3_600 }]);
  });
});

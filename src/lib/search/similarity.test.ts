import { describe, expect, it } from "vitest";

import {
  MAX_DISTANCE,
  MAX_RESULTS,
  MIN_SIMILARITY,
  formatMatchPercent,
  toSimilarity,
} from "./similarity";

describe("toSimilarity", () => {
  it("converts cosine distance into similarity", () => {
    expect(toSimilarity(0)).toBe(1);
    expect(toSimilarity(0.31)).toBeCloseTo(0.69);
    expect(toSimilarity(0.5)).toBe(0.5);
    expect(toSimilarity(1)).toBe(0);
  });

  it("clamps similarities to the 0..1 range", () => {
    expect(toSimilarity(2)).toBe(0);
    expect(toSimilarity(-0.5)).toBe(1);
    expect(toSimilarity(Number.NaN)).toBe(0);
  });
});

describe("formatMatchPercent", () => {
  it("renders a rounded match percentage", () => {
    expect(formatMatchPercent(0.69)).toBe("69% match");
    expect(formatMatchPercent(0.694)).toBe("69% match");
    expect(formatMatchPercent(0.5)).toBe("50% match");
  });
});

describe("search limits", () => {
  it("uses a 50% match threshold and at most 20 results", () => {
    expect(MIN_SIMILARITY).toBe(0.5);
    expect(MAX_DISTANCE).toBe(0.5);
    expect(MAX_RESULTS).toBe(20);
  });
});

import { describe, expect, it } from "vitest";

import {
  formatRateLimitError,
  getRateLimitWindowStart,
} from "./rateLimit";

describe("getRateLimitWindowStart", () => {
  it("looks back the configured number of hours from now", () => {
    const now = new Date("2026-10-21T12:00:00Z");

    expect(getRateLimitWindowStart(now, 24)).toEqual(
      new Date("2026-10-20T12:00:00Z"),
    );
  });

  it("supports fractional hour windows", () => {
    const now = new Date("2026-10-21T12:00:00Z");

    expect(getRateLimitWindowStart(now, 0.5)).toEqual(
      new Date("2026-10-21T11:30:00Z"),
    );
  });
});

describe("formatRateLimitError", () => {
  it("describes the configured quota", () => {
    expect(formatRateLimitError(20, 24)).toBe(
      "You've reached the limit of 20 searches per 24 hours. Please try again later.",
    );
  });

  it("uses singular labels when appropriate", () => {
    expect(formatRateLimitError(1, 1)).toBe(
      "You've reached the limit of 1 search per 1 hour. Please try again later.",
    );
  });
});

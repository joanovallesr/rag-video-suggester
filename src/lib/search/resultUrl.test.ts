import { describe, expect, it } from "vitest";
import { buildResultUrl } from "./resultUrl";

describe("buildResultUrl", () => {
  it("appends the timestamp with & when the URL already has a query", () => {
    expect(
      buildResultUrl("https://www.youtube.com/watch?v=abc123", "video", 90),
    ).toBe("https://www.youtube.com/watch?v=abc123&t=90");
  });

  it("uses ? when the URL has no query string", () => {
    expect(buildResultUrl("https://example.com/clip", "video", 12)).toBe(
      "https://example.com/clip?t=12",
    );
  });

  it("floors fractional start positions", () => {
    expect(
      buildResultUrl("https://www.youtube.com/watch?v=abc123", "video", 12.9),
    ).toBe("https://www.youtube.com/watch?v=abc123&t=12");
  });

  it("leaves article URLs untouched", () => {
    expect(
      buildResultUrl("https://fifteensquared.net/post", "article", 30),
    ).toBe("https://fifteensquared.net/post");
  });

  it("leaves videos without a timestamp untouched", () => {
    expect(
      buildResultUrl("https://www.youtube.com/watch?v=abc123", "video", null),
    ).toBe("https://www.youtube.com/watch?v=abc123");
  });

  it("replaces an existing timestamp instead of duplicating it", () => {
    expect(
      buildResultUrl("https://www.youtube.com/watch?v=abc123&t=5", "video", 42),
    ).toBe("https://www.youtube.com/watch?v=abc123&t=42");
  });

  it("returns the original value for an unparseable URL", () => {
    expect(buildResultUrl("not a url", "video", 10)).toBe("not a url");
  });
});

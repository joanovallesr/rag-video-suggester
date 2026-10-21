import type { youtube_v3 } from "googleapis";
import { describe, expect, it } from "vitest";
import {
  buildVideoUrl,
  classifyVideo,
  parseIsoDuration,
  pickThumbnail,
  videoIdFromUrl,
} from "./video";

function details(overrides: {
  duration?: string | null;
  liveBroadcastContent?: string | null;
  title?: string | null;
  description?: string | null;
  publishedAt?: string | null;
  thumbnails?: youtube_v3.Schema$ThumbnailDetails;
} = {}): youtube_v3.Schema$Video {
  return {
    snippet: {
      title: overrides.title === undefined ? "A puzzle" : overrides.title,
      description:
        overrides.description === undefined ? "Solve it" : overrides.description,
      publishedAt:
        overrides.publishedAt === undefined
          ? "2026-10-01T12:00:00Z"
          : overrides.publishedAt,
      liveBroadcastContent:
        overrides.liveBroadcastContent === undefined
          ? "none"
          : overrides.liveBroadcastContent,
      thumbnails:
        overrides.thumbnails === undefined
          ? { high: { url: "https://img.example/high.jpg" } }
          : overrides.thumbnails,
    },
    contentDetails: {
      duration: overrides.duration === undefined ? "PT10M" : overrides.duration,
    },
  };
}

function playlistItem(
  videoId: string | null,
  thumbnails?: youtube_v3.Schema$ThumbnailDetails,
): youtube_v3.Schema$PlaylistItem {
  return {
    contentDetails: videoId ? { videoId } : undefined,
    snippet: thumbnails ? { thumbnails } : undefined,
  };
}

describe("parseIsoDuration", () => {
  it("parses hours, minutes and seconds", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3_723);
  });

  it("parses partial durations", () => {
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT2M")).toBe(120);
    expect(parseIsoDuration("P1DT2H")).toBe(93_600);
  });

  it("returns null for missing or malformed values", () => {
    expect(parseIsoDuration(undefined)).toBeNull();
    expect(parseIsoDuration("")).toBeNull();
    expect(parseIsoDuration("10 minutes")).toBeNull();
    expect(parseIsoDuration("P")).toBeNull();
  });
});

describe("pickThumbnail", () => {
  it("prefers the largest available size", () => {
    expect(
      pickThumbnail({
        high: { url: "https://img.example/high.jpg" },
        maxres: { url: "https://img.example/maxres.jpg" },
      }),
    ).toBe("https://img.example/maxres.jpg");
  });

  it("falls back through smaller sizes", () => {
    expect(
      pickThumbnail({ default: { url: "https://img.example/default.jpg" } }),
    ).toBe("https://img.example/default.jpg");
  });

  it("returns null when no thumbnail exists", () => {
    expect(pickThumbnail(null)).toBeNull();
    expect(pickThumbnail({})).toBeNull();
  });
});

describe("video URLs", () => {
  it("builds the canonical watch URL", () => {
    expect(buildVideoUrl("abc123")).toBe(
      "https://www.youtube.com/watch?v=abc123",
    );
  });

  it("extracts the video id from watch and short URLs", () => {
    expect(videoIdFromUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "abc123",
    );
    expect(videoIdFromUrl("https://youtu.be/abc123")).toBe("abc123");
    expect(videoIdFromUrl("https://example.com/post")).toBeNull();
    expect(videoIdFromUrl("not a url")).toBeNull();
  });
});

describe("classifyVideo", () => {
  it("accepts a normal upload", () => {
    const result = classifyVideo(playlistItem("abc123"), details());
    expect(result).toEqual({
      status: "candidate",
      video: {
        videoId: "abc123",
        title: "A puzzle",
        description: "Solve it",
        publishedAt: "2026-10-01T12:00:00Z",
        url: "https://www.youtube.com/watch?v=abc123",
        thumbnailUrl: "https://img.example/high.jpg",
        durationSeconds: 600,
      },
    });
  });

  it("ignores live and upcoming broadcasts without ledgering them", () => {
    expect(
      classifyVideo(playlistItem("abc123"), details({ liveBroadcastContent: "live" })),
    ).toEqual({ status: "ignore" });
    expect(
      classifyVideo(
        playlistItem("abc123"),
        details({ liveBroadcastContent: "upcoming" }),
      ),
    ).toEqual({ status: "ignore" });
  });

  it("keeps finished streams, whose live status is none", () => {
    const result = classifyVideo(
      playlistItem("abc123"),
      details({ liveBroadcastContent: "none", duration: "PT2H" }),
    );
    expect(result.status).toBe("candidate");
  });

  it("skips videos shorter than a minute", () => {
    expect(
      classifyVideo(playlistItem("abc123"), details({ duration: "PT59S" })),
    ).toEqual({ status: "skip", videoId: "abc123", reason: "too_short" });
  });

  it("keeps videos of exactly one minute", () => {
    expect(
      classifyVideo(playlistItem("abc123"), details({ duration: "PT1M" })).status,
    ).toBe("candidate");
  });

  it("skips videos whose details are missing", () => {
    expect(classifyVideo(playlistItem("abc123"), undefined)).toEqual({
      status: "skip",
      videoId: "abc123",
      reason: "unavailable",
    });
  });

  it("ignores items without a video id", () => {
    expect(classifyVideo(playlistItem(null), undefined)).toEqual({
      status: "ignore",
    });
  });

  it("falls back to the playlist item's thumbnail", () => {
    const result = classifyVideo(
      playlistItem("abc123", { medium: { url: "https://img.example/medium.jpg" } }),
      details({ thumbnails: {} }),
    );

    expect(result.status).toBe("candidate");
    if (result.status === "candidate") {
      expect(result.video.thumbnailUrl).toBe("https://img.example/medium.jpg");
    }
  });

  it("defaults an empty description to an empty string", () => {
    const result = classifyVideo(
      playlistItem("abc123"),
      details({ description: null }),
    );

    expect(result.status).toBe("candidate");
    if (result.status === "candidate") {
      expect(result.video.description).toBe("");
    }
  });
});

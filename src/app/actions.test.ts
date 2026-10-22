import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("../lib/auth/config", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("../data/serverEnv", () => ({
  serverEnv: { RATE_LIMIT_MAX_REQUESTS: 2, RATE_LIMIT_WINDOW_HOURS: 24 },
}));

vi.mock("../lib/search/search", () => ({
  searchContent: vi.fn(),
}));

vi.mock("../lib/search/searchHistory", () => ({
  beginSearch: vi.fn(),
  recordSearchResults: vi.fn(),
}));

import { auth } from "../lib/auth/config";
import { searchContent } from "../lib/search/search";
import {
  beginSearch,
  recordSearchResults,
} from "../lib/search/searchHistory";
import type { ContentSearchResult } from "../lib/search/types";
import { searchContentAction } from "./actions";

const getSessionMock = vi.mocked(auth.api.getSession);
const searchContentMock = vi.mocked(searchContent);
const beginSearchMock = vi.mocked(beginSearch);
const recordSearchResultsMock = vi.mocked(recordSearchResults);

function result(contentId: string): ContentSearchResult {
  return {
    contentId,
    title: "Result",
    description: "A result",
    thumbnailUrl: null,
    url: `https://example.com/${contentId}`,
    publishDate: "2026-10-21",
    type: "article",
    similarity: 0.9,
    startPosition: null,
    text: "Matched text",
  };
}

function signIn() {
  getSessionMock.mockResolvedValue({ user: { id: "user-1" } } as never);
}

describe("searchContentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    signIn();
    beginSearchMock.mockResolvedValue("search-1");
    recordSearchResultsMock.mockResolvedValue();
  });

  it("requires a signed-in user", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await searchContentAction("crossword");

    expect(response).toEqual({ error: "You need to sign in to search." });
    expect(beginSearchMock).not.toHaveBeenCalled();
    expect(searchContentMock).not.toHaveBeenCalled();
  });

  it("rejects invalid queries", async () => {
    const response = await searchContentAction("   ");

    expect(response).toEqual({
      error: "Enter a search query up to 500 characters.",
    });
    expect(beginSearchMock).not.toHaveBeenCalled();
  });

  it("rejects searches once the rolling window quota is reached", async () => {
    beginSearchMock.mockResolvedValue(null);

    const response = await searchContentAction("crossword");

    expect(response).toEqual({
      error:
        "You've reached the limit of 2 searches per 24 hours. Please try again later.",
    });
    expect(beginSearchMock).toHaveBeenCalledWith({
      userId: "user-1",
      queryText: "crossword",
      since: expect.any(Date),
      maxRequests: 2,
    });
    expect(searchContentMock).not.toHaveBeenCalled();
  });

  it("records the query before searching and attaches the result ids", async () => {
    const results = [result("content-1"), result("content-2")];
    searchContentMock.mockResolvedValue(results);

    const response = await searchContentAction("  crossword  ");

    expect(beginSearchMock).toHaveBeenCalledWith({
      userId: "user-1",
      queryText: "crossword",
      since: expect.any(Date),
      maxRequests: 2,
    });
    expect(searchContentMock).toHaveBeenCalledWith("crossword");
    expect(recordSearchResultsMock).toHaveBeenCalledWith(
      "user-1",
      "search-1",
      ["content-1", "content-2"],
    );
    expect(response).toEqual({ results });
  });

  it("returns an error when the search itself fails", async () => {
    searchContentMock.mockRejectedValue(new Error("embedding failed"));

    const response = await searchContentAction("crossword");

    expect(response).toEqual({ error: "Search failed. Please try again." });
    expect(recordSearchResultsMock).not.toHaveBeenCalled();
  });

  it("keeps results when recording them fails", async () => {
    const results = [result("content-1")];
    searchContentMock.mockResolvedValue(results);
    recordSearchResultsMock.mockRejectedValue(new Error("write failed"));

    const response = await searchContentAction("crossword");

    expect(response).toEqual({ results });
  });
});

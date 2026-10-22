"use client";

import { useState, type FormEvent } from "react";

import { decodeHtmlEntities } from "../lib/search/decodeEntities";
import { buildResultUrl } from "../lib/search/resultUrl";
import { formatMatchPercent } from "../lib/search/similarity";
import type { ContentSearchResult } from "../lib/search/types";
import { searchContentAction } from "./actions";
import { SignInButton } from "./auth-controls";

type SearchPanelProps = {
  isSignedIn: boolean;
};

/**
 * The search bar and result list. Search calls a server function so the query
 * embedding and vector lookup stay on the server.
 */
export function SearchPanel({ isSignedIn }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContentSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSignedIn || isSearching) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter something to search for.");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const result = await searchContentAction(trimmed);
      if ("error" in result) {
        setError(result.error);
        setResults(null);
      } else {
        setResults(result.results);
      }
    } catch {
      setError("Search failed. Please try again.");
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <label htmlFor="search" className="sr-only">
            Search content
          </label>
          <div className="relative flex-1">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-zinc-500"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              id="search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={!isSignedIn || isSearching}
              placeholder={
                isSignedIn
                  ? "Search crosswords clues, wordplay, and solve walkthroughs..."
                  : "Sign in to search"
              }
              className="h-14 w-full rounded-xl border border-white/10 bg-zinc-900 pr-4 pl-12 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={!isSignedIn || isSearching}
            className="flex h-14 items-center gap-2 rounded-xl bg-blue-600 px-7 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearching ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            )}
            {isSearching ? "Searching…" : "Search"}
          </button>
        </form>

        {!isSignedIn ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-zinc-900/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-400">
              You need to sign in to search the archive.
            </p>
            <SignInButton />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        ) : null}
      </div>

      {results !== null ? (
        <section aria-live="polite" className="flex flex-col gap-4">
          <p className="text-sm text-zinc-500">
            {results.length} {results.length === 1 ? "result" : "results"} found
          </p>

          {results.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-zinc-900/60 px-5 py-8 text-center text-sm text-zinc-400">
              No content matched your search. Try a different query.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((result) => (
                <SearchResultCard key={result.url} result={result} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function SearchResultCard({ result }: { result: ContentSearchResult }) {
  return (
    <li>
      <a
        href={buildResultUrl(result.url, result.type, result.startPosition)}
        target="_blank"
        rel="noreferrer"
        className="group flex gap-5 rounded-xl border border-white/10 bg-zinc-900/60 p-4 transition-colors hover:border-white/20 hover:bg-zinc-900"
      >
        <div className="h-24 w-40 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
          {result.thumbnailUrl ? (
            // Thumbnails come from arbitrary source sites, so they bypass
            // next/image's remote-pattern allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-600">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-8 w-8"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="m3 15 5-5 4 4 3-3 6 6" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-medium text-zinc-100 group-hover:underline">
              {result.title}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
              {decodeHtmlEntities(
                result.type === "video" ? result.text : result.description,
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              {result.type === "video" && result.startPosition !== null ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400/10 px-2 py-1 text-emerald-300">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-3.5 w-3.5"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="m10 8 6 4-6 4V8Z" />
                  </svg>
                  {formatTimestamp(result.startPosition)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-zinc-300">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-3.5 w-3.5"
                >
                  {result.type === "video" ? (
                    <>
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m10 9 5 3-5 3V9Z" />
                    </>
                  ) : (
                    <>
                      <path d="M7 3h7l5 5v13H7V3Z" />
                      <path d="M14 3v5h5M10 13h4M10 17h4" />
                    </>
                  )}
                </svg>
                {result.type}
              </span>
              <span>{formatPublishDate(result.publishDate)}</span>
            </div>
          </div>

          <span className="shrink-0 text-sm font-medium text-emerald-400">
            {formatMatchPercent(result.similarity)}
          </span>
        </div>
      </a>
    </li>
  );
}

function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(remainder)}`
    : `${minutes}:${pad(remainder)}`;
}

function formatPublishDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

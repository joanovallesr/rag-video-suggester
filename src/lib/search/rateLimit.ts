const MILLISECONDS_PER_HOUR = 3_600_000;

/**
 * Start of the rolling rate-limit window that ends at `now`.
 *
 * The limit looks back a fixed number of hours from the current time rather
 * than using calendar buckets, so a user always gets the full window back after
 * their oldest counted search.
 */
export function getRateLimitWindowStart(now: Date, windowHours: number): Date {
  return new Date(now.getTime() - windowHours * MILLISECONDS_PER_HOUR);
}

/** User-facing error shown by the search UI when the quota is exhausted. */
export function formatRateLimitError(
  maxRequests: number,
  windowHours: number,
): string {
  const searchLabel = maxRequests === 1 ? "search" : "searches";
  const hourLabel = windowHours === 1 ? "hour" : "hours";

  return `You've reached the limit of ${maxRequests} ${searchLabel} per ${windowHours} ${hourLabel}. Please try again later.`;
}

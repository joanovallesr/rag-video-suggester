import { sleep } from "workflow";

type BatchCounts = {
  total: number;
  succeeded: number;
  failed: number;
};

type BatchCountsWithSkips = BatchCounts & {
  skipped: number;
  aborted: boolean;
};

type BatchExecOptions = {
  batchSize?: number;
  delayMs?: number;
};

type ResultAwareBatchExecOptions<R> = BatchExecOptions & {
  /** Count a fulfilled result as skipped instead of succeeded. */
  isSkipped: (result: R) => boolean;
  /** Stop scheduling batches after a result such as a rate-limit block. */
  shouldStop: (result: R) => boolean;
};

/**
 * Run `fn` over `items` in batches. Each batch is settled independently so one
 * item's failure does not abort the rest of the batch. `sleep` is only awaited
 * between batches (never after the last one), and only when `delayMs > 0`.
 *
 * With `isSkipped`/`shouldStop`, the result-aware overload also reports skipped
 * items and whether a batch stopped the run. The plain overload keeps the
 * original `{ total, succeeded, failed }` shape.
 */
export function batchExec<T, R>(
  items: T[],
  fn: (batch: T) => Promise<R>,
  options: ResultAwareBatchExecOptions<R>,
): Promise<BatchCountsWithSkips>;
export function batchExec<T>(
  items: T[],
  fn: (batch: T) => Promise<void>,
  options?: BatchExecOptions,
): Promise<BatchCounts>;
export async function batchExec<T, R = void>(
  items: T[],
  fn: (batch: T) => Promise<R>,
  {
    batchSize = 10,
    delayMs = 0,
    isSkipped,
    shouldStop,
  }: BatchExecOptions & Partial<ResultAwareBatchExecOptions<R>> = {},
): Promise<BatchCounts | BatchCountsWithSkips> {
  let totalSucceeded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let aborted = false;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const outcomes = await Promise.allSettled(batch.map(fn));

    for (const outcome of outcomes) {
      if (outcome.status === "rejected") {
        totalFailed++;
        continue;
      }

      if (isSkipped?.(outcome.value)) {
        totalSkipped++;
        continue;
      }

      if (shouldStop?.(outcome.value)) {
        totalFailed++;
        aborted = true;
        continue;
      }

      totalSucceeded++;
    }

    if (aborted) break;

    if (delayMs > 0 && i + batchSize < items.length) {
      await sleep(delayMs);
    }
  }

  const counts = {
    total: items.length,
    succeeded: totalSucceeded,
    failed: totalFailed,
  };

  if (!isSkipped && !shouldStop) return counts;

  return { ...counts, skipped: totalSkipped, aborted };
}

import { sleep } from "workflow";

/**
 * Run `fn` over `items` in batches. Each batch is settled independently so one
 * item's failure does not abort the rest of the batch. `sleep` is only awaited
 * between batches (never after the last one), and only when `delayMs > 0`.
 */
export async function batchExec<T>(
  items: T[],
  fn: (batch: T) => Promise<void>,
  { batchSize = 10, delayMs = 0 } = {},
) {
  let totalSucceeded = 0;
  let totalFailed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const outcomes = await Promise.allSettled(batch.map(fn));

    outcomes.forEach((outcome) => {
      if (outcome.status === "fulfilled") {
        totalSucceeded++;
      } else {
        totalFailed++;
      }
    });

    if (delayMs > 0 && i + batchSize < items.length) {
      await sleep(delayMs);
    }
  }

  return { total: items.length, succeeded: totalSucceeded, failed: totalFailed };
}

/** Retry an async operation with exponential backoff.
 *
 *  Useful for RPC rate-limits and transient network errors.
 *  User rejections are never retried. */

import { isUserRejection } from "./errors";

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Initial delay in ms before first retry. Default: 1000 */
  baseDelay?: number;
  /** Multiplier applied to delay after each failure. Default: 2 */
  backoffFactor?: number;
  /** Maximum delay cap in ms. Default: 10000 */
  maxDelay?: number;
  /** Decide whether a failure is worth another attempt. Defaults to a
   *  message sniff for network / rate-limit wording, which is all a
   *  wallet-surfaced RPC error gives us. Callers with typed errors should
   *  pass something precise. User rejections are never retried regardless. */
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULTS: Required<Omit<RetryOptions, "shouldRetry">> = {
  maxAttempts: 3,
  baseDelay: 1000,
  backoffFactor: 2,
  maxDelay: 10_000,
};

/** Returns true for errors that are safe to retry (network/RPC issues). */
function isRetryable(error: Error): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed")
  );
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULTS, ...options };
  const shouldRetry = options?.shouldRetry ?? isRetryable;
  let lastError: Error | null = null;
  let delay = opts.baseDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (
        isUserRejection(lastError) ||
        !shouldRetry(lastError) ||
        attempt === opts.maxAttempts
      ) {
        throw lastError;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
    }
  }

  throw lastError;
}

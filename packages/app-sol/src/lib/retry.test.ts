import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { retryWithBackoff } from "./retry";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately on first-try success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(retryWithBackoff(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable network errors and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockRejectedValueOnce(new Error("rate limit exceeded"))
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, { baseDelay: 100, backoffFactor: 2 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry user rejections", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new Error("User rejected the request."));

    await expect(retryWithBackoff(fn)).rejects.toThrow("User rejected");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry user denied errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("user denied transaction"));
    await expect(retryWithBackoff(fn)).rejects.toThrow("user denied");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-retryable errors (e.g. revert)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new Error("execution reverted: insufficient allowance"));

    await expect(retryWithBackoff(fn)).rejects.toThrow("reverted");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429, 502, 503, ECONNRESET, fetch failed, timeout", async () => {
    const messages = [
      "Request failed with 429",
      "502 Bad Gateway",
      "503 Service Unavailable",
      "ECONNRESET",
      "fetch failed",
      "timeout exceeded",
    ];

    for (const msg of messages) {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error(msg))
        .mockResolvedValueOnce("ok");

      const promise = retryWithBackoff(fn, {
        baseDelay: 10,
        backoffFactor: 1,
        maxAttempts: 2,
      });
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });

  it("throws lastError after maxAttempts of retryable failures", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network down"));
    const promise = retryWithBackoff(fn, {
      maxAttempts: 3,
      baseDelay: 10,
      backoffFactor: 2,
    });
    const assertion = expect(promise).rejects.toThrow("network down");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("applies exponential backoff between attempts", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network 1"))
      .mockRejectedValueOnce(new Error("network 2"))
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, {
      baseDelay: 1000,
      backoffFactor: 2,
      maxAttempts: 3,
    });

    // First attempt fires synchronously
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // Wait baseDelay (1000ms) for second attempt
    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);

    // Wait baseDelay * backoffFactor (2000ms) for third attempt
    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toBe("ok");
  });

  it("caps delay at maxDelay", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network 1"))
      .mockRejectedValueOnce(new Error("network 2"))
      .mockRejectedValueOnce(new Error("network 3"))
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, {
      baseDelay: 1000,
      backoffFactor: 10, // would explode without the cap
      maxDelay: 2000,
      maxAttempts: 4,
    });

    // attempt 1 fires immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // baseDelay = 1000 → attempt 2
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // delay = min(1000 * 10, 2000) = 2000 → attempt 3
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    // delay still capped at 2000 → attempt 4
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(4);

    await expect(promise).resolves.toBe("ok");
  });

  it("wraps thrown non-Error values into Error", async () => {
    const fn = vi.fn().mockImplementation(() => {
      throw "string error not Error instance";
    });

    await expect(retryWithBackoff(fn)).rejects.toThrow(
      "string error not Error instance",
    );
    expect(fn).toHaveBeenCalledTimes(1); // not retryable
  });

  it("respects custom maxAttempts of 1 (single try, no retry)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network"));
    const promise = retryWithBackoff(fn, { maxAttempts: 1 });
    const assertion = expect(promise).rejects.toThrow("network");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

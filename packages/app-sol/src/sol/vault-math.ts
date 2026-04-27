/**
 * Pure math for stream status + withdrawable amount + progress.
 *
 * Mirrors Sablier Lockup-Linear's accrual model so the UI can show live
 * countdowns and claimable estimates without an RPC round-trip. The actual
 * claim instruction reads withdrawable from the program, so any drift here
 * shows up as a UI-vs-on-chain delta — these tests pin the math against
 * the formula encoded in the program.
 *
 * RipGuard always sets start_unlock_amount = 0 and cliff_unlock_amount = 0
 * (locked-self model — no front-loading), but the formulas here support
 * non-zero values for completeness so we don't have to revisit if we ever
 * support a "small bonus at the start" preset.
 */

export type StreamStatus =
  | "Pending"
  | "Streaming"
  | "Settled"
  | "Canceled"
  | "Depleted";

export interface StreamSnapshot {
  // Times in seconds (as stored in StreamData.timestamps).
  startTime: bigint;
  cliffTime: bigint; // 0 means no cliff
  endTime: bigint;
  // Amounts in deposit-token base units.
  deposited: bigint;
  startUnlock: bigint;
  cliffUnlock: bigint;
  withdrawn: bigint;
  refunded: bigint;
  // Boolean flags from StreamData.
  isCancelable: boolean;
  isDepleted: boolean;
  wasCanceled: boolean;
}

/**
 * Derive the lifecycle status of a stream at a given moment.
 *
 *   Pending   — t < start (or t < cliff if cliff > 0)
 *   Streaming — actively accruing
 *   Settled   — fully accrued, recipient hasn't claimed everything yet
 *   Canceled  — sender canceled before settled (only for cancelable streams)
 *   Depleted  — recipient has claimed everything
 */
export function streamStatus(
  stream: StreamSnapshot,
  nowSeconds: bigint,
): StreamStatus {
  if (stream.isDepleted) return "Depleted";
  if (stream.wasCanceled) return "Canceled";
  if (stream.cliffTime > 0n && nowSeconds < stream.cliffTime) return "Pending";
  if (nowSeconds < stream.startTime) return "Pending";
  if (nowSeconds >= stream.endTime) return "Settled";
  return "Streaming";
}

/**
 * Total amount streamed (i.e. accrued to the recipient) at a given time.
 *
 * Linear accrual between cliff (or start, whichever is later) and end:
 *
 *   streamed(t) = startUnlock
 *               + cliffUnlock        (if t >= cliff)
 *               + linearAmount * (t - effectiveStart) / (end - effectiveStart)
 *
 * where linearAmount = deposited - startUnlock - cliffUnlock and
 * effectiveStart = max(start, cliff).
 */
export function streamedAmount(
  stream: StreamSnapshot,
  nowSeconds: bigint,
): bigint {
  const { startTime, cliffTime, endTime, deposited, startUnlock, cliffUnlock } =
    stream;

  if (nowSeconds < startTime) return 0n;
  if (cliffTime > 0n && nowSeconds < cliffTime) return startUnlock;
  if (nowSeconds >= endTime) return deposited;

  const effectiveStart = cliffTime > 0n && cliffTime > startTime ? cliffTime : startTime;
  const elapsed = nowSeconds - effectiveStart;
  const totalDuration = endTime - effectiveStart;
  if (totalDuration <= 0n) return deposited;

  const linearAmount = deposited - startUnlock - cliffUnlock;
  const linearAccrued = (linearAmount * elapsed) / totalDuration;

  return startUnlock + cliffUnlock + linearAccrued;
}

/**
 * Amount the recipient can withdraw right now.
 */
export function withdrawableAmount(
  stream: StreamSnapshot,
  nowSeconds: bigint,
): bigint {
  if (stream.isDepleted) return 0n;
  const accrued = streamedAmount(stream, nowSeconds);
  // refunded only applies to canceled streams; withdrawn is always tracked.
  const claimable = accrued - stream.withdrawn;
  return claimable > 0n ? claimable : 0n;
}

/**
 * Progress as a fraction in [0, 1].
 */
export function streamProgress(
  stream: StreamSnapshot,
  nowSeconds: bigint,
): number {
  if (stream.deposited <= 0n) return 0;
  const accrued = streamedAmount(stream, nowSeconds);
  if (accrued >= stream.deposited) return 1;
  // Convert via Number — we lose <0.0001% precision on huge bigints,
  // which is fine for a progress bar.
  return Number(accrued) / Number(stream.deposited);
}

/**
 * Seconds until the next meaningful unlock event:
 *   - If pending and there's a cliff, time until cliff.
 *   - If pending and no cliff, time until start.
 *   - If streaming, time until end.
 *   - Otherwise null.
 */
export function secondsUntilNext(
  stream: StreamSnapshot,
  nowSeconds: bigint,
): bigint | null {
  const status = streamStatus(stream, nowSeconds);
  if (status === "Pending") {
    const target = stream.cliffTime > 0n ? stream.cliffTime : stream.startTime;
    return target - nowSeconds;
  }
  if (status === "Streaming") {
    return stream.endTime - nowSeconds;
  }
  return null;
}

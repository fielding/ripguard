/**
 * Translate a RipGuard preset (as defined in `config/solsab.ts`) into the
 * exact u64 args Sablier's `create_with_durations_ll` expects.
 *
 * The chain-agnostic preset shape:
 *   { cliffSeconds, totalSeconds, isLumpSum }
 *
 * The Solana instruction shape:
 *   (cliff_duration, total_duration, start_unlock_amount, cliff_unlock_amount, is_cancelable)
 *
 * RipGuard streams are always non-cancelable, never front-loaded — the
 * "locked-self" model means past-you sets the rules and future-you only
 * gets what the schedule unlocks. So `start_unlock_amount` and
 * `cliff_unlock_amount` are always 0 here.
 *
 * The Solana "panic lock" presets (single-cliff, no streaming after) are
 * encoded with `cliffSeconds === totalSeconds - 1` because Sablier requires
 * `cliff_duration < total_duration` strictly. The preset definition in
 * solsab.ts already accounts for that.
 */
import { PRESETS, type PresetKey } from "@/config/solsab";

export interface SolanaCreateArgs {
  cliffSeconds: number;
  totalSeconds: number;
  startUnlockAmount: bigint;
  cliffUnlockAmount: bigint;
  isCancelable: boolean;
}

export function presetToSolanaArgs(key: PresetKey): SolanaCreateArgs {
  const preset = PRESETS[key];
  return {
    cliffSeconds: preset.cliffSeconds,
    totalSeconds: preset.totalSeconds,
    startUnlockAmount: 0n,
    cliffUnlockAmount: 0n,
    isCancelable: false,
  };
}

/**
 * Same translation but for a custom (non-preset) schedule the user defines
 * in the form. Validates Sablier's strict cliff < total constraint.
 */
export function customScheduleToSolanaArgs(params: {
  cliffSeconds: number;
  totalSeconds: number;
}): SolanaCreateArgs {
  if (params.totalSeconds <= 0) {
    throw new RangeError(
      `totalSeconds must be > 0 (got ${params.totalSeconds})`,
    );
  }
  if (params.cliffSeconds < 0) {
    throw new RangeError(
      `cliffSeconds must be >= 0 (got ${params.cliffSeconds})`,
    );
  }
  if (params.cliffSeconds > 0 && params.cliffSeconds >= params.totalSeconds) {
    throw new RangeError(
      `cliffSeconds (${params.cliffSeconds}) must be < totalSeconds (${params.totalSeconds})`,
    );
  }
  return {
    cliffSeconds: params.cliffSeconds,
    totalSeconds: params.totalSeconds,
    startUnlockAmount: 0n,
    cliffUnlockAmount: 0n,
    isCancelable: false,
  };
}

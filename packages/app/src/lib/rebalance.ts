export type RebalanceInput = {
  stablePct: number;
  convictionPct: number;
  speculativePct: number;
  dryPowderPct: number;
  volatility: "calm" | "mixed" | "chaotic";
  horizon: "short" | "mid" | "long";
};

export type RebalanceOutput = {
  totalPct: number;
  imbalancePct: number;
  guidance: string;
  primaryMove: string;
  suggestedPreset: "panicLock7d" | "lock30d" | "cliff7dVest90d";
  dangerLevel: "balanced" | "drifting" | "exposed";
  checklist: string[];
};

const VOLATILITY_SCORE = {
  calm: -6,
  mixed: 0,
  chaotic: 10,
} as const;

const HORIZON_SCORE = {
  short: 9,
  mid: 0,
  long: -5,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function analyzeRebalance(input: RebalanceInput): RebalanceOutput {
  const totalPct = input.stablePct + input.convictionPct + input.speculativePct + input.dryPowderPct;
  const imbalancePct = Math.abs(100 - totalPct);
  const pressureScore =
    input.speculativePct * 0.55
    - input.stablePct * 0.15
    - input.dryPowderPct * 0.25
    + VOLATILITY_SCORE[input.volatility]
    + HORIZON_SCORE[input.horizon]
    + imbalancePct * 0.8;

  let dangerLevel: RebalanceOutput["dangerLevel"] = "balanced";
  let guidance = "Your stack is close to intentional. Focus on maintaining discipline rather than reacting to noise.";
  let primaryMove = "Skim profits from conviction bets into dry powder on strength.";
  let suggestedPreset: RebalanceOutput["suggestedPreset"] = "lock30d";
  let checklist = [
    "Keep stable capital sized for one bad week, not one perfect thesis.",
    "Avoid rotating straight from speculative bags into new speculative bags.",
    "Refresh your lock allocation whenever portfolio weights drift by more than 10 points.",
  ];

  if (pressureScore >= 36) {
    dangerLevel = "exposed";
    guidance = "Your stack is running hot for the current volatility regime. Reduce reflexive risk before you need to.";
    primaryMove = "Cut speculative weight first and park the reduction in dry powder or a short lock.";
    suggestedPreset = "panicLock7d";
    checklist = [
      "Trim speculative exposure before adding to conviction winners.",
      "Do not count locked conviction positions as liquid dry powder.",
      "Route any short-covering bounce into protection, not fresh leverage.",
    ];
  } else if (pressureScore >= 18) {
    dangerLevel = "drifting";
    guidance = "You are not over the line yet, but the portfolio is drifting away from a resilient base.";
    primaryMove = "Rebuild the buffer before taking new directional bets.";
    suggestedPreset = "cliff7dVest90d";
    checklist = [
      "Move one sleeve of gains into a longer cooldown bucket this week.",
      "Use dry powder thresholds instead of feelings to decide re-entry.",
      "Treat any category above 45% as concentration risk unless it is intentionally locked.",
    ];
  }

  return {
    totalPct,
    imbalancePct: clamp(Number(imbalancePct.toFixed(1)), 0, 100),
    guidance,
    primaryMove,
    suggestedPreset,
    dangerLevel,
    checklist,
  };
}

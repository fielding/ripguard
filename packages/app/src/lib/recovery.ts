export type RecoveryProfile = {
  bankrollUsd: number;
  drawdownPct: number;
  monthlyBurnUsd: number;
  conviction: "fragile" | "steady" | "strong";
  liquidityNeed: "high" | "medium" | "low";
};

export type RecoveryPlan = {
  recoveryScore: number;
  runwayMonths: number;
  protectedCapitalUsd: number;
  riskBand: "stabilize" | "rebuild" | "press";
  summary: string;
  immediateActions: string[];
  lockSuggestion: {
    preset: "panicLock7d" | "lock30d" | "cliff7dVest90d";
    title: string;
    cooldownDays: number;
    protectedPct: number;
  };
  checkpoints: Array<{
    label: string;
    detail: string;
  }>;
};

const CONVICTION_WEIGHT = {
  fragile: -12,
  steady: 0,
  strong: 10,
} as const;

const LIQUIDITY_WEIGHT = {
  high: -10,
  medium: 0,
  low: 10,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function buildRecoveryPlan(profile: RecoveryProfile): RecoveryPlan {
  const runwayMonths = profile.monthlyBurnUsd > 0
    ? Number((profile.bankrollUsd / profile.monthlyBurnUsd).toFixed(1))
    : 12;

  const startingScore = 64;
  const score =
    startingScore
    - profile.drawdownPct * 0.6
    + runwayMonths * 3
    + CONVICTION_WEIGHT[profile.conviction]
    + LIQUIDITY_WEIGHT[profile.liquidityNeed];

  const recoveryScore = clamp(Math.round(score), 8, 96);
  const protectedPct = clamp(
    roundToNearest(30 + profile.drawdownPct * 0.45 + (profile.liquidityNeed === "high" ? 10 : 0), 5),
    25,
    85,
  );
  const protectedCapitalUsd = Math.round(profile.bankrollUsd * (protectedPct / 100));

  let riskBand: RecoveryPlan["riskBand"] = "rebuild";
  let summary = "Balance emotional damage control with a slower rebuild plan.";
  let lockSuggestion: RecoveryPlan["lockSuggestion"] = {
    preset: "lock30d",
    title: "30-day stabilization lock",
    cooldownDays: 30,
    protectedPct,
  };
  let immediateActions = [
    "Pause new size increases until two green weeks close.",
    "Route a fixed slice of each gain into protected capital.",
    "Review correlation clusters before re-entering similar trades.",
  ];

  if (recoveryScore <= 40) {
    riskBand = "stabilize";
    summary = "Capital protection matters more than speed. Bias toward cooldown and smaller re-entry size.";
    lockSuggestion = {
      preset: "panicLock7d",
      title: "7-day damage-control lock",
      cooldownDays: 7,
      protectedPct,
    };
    immediateActions = [
      "Cap next-week risk to one-third of recent average sizing.",
      "Protect any rebound quickly instead of waiting for a full recovery.",
      "Avoid reopening the exact setup that caused the drawdown until conditions change.",
    ];
  } else if (recoveryScore >= 75) {
    riskBand = "press";
    summary = "Runway and conviction are healthy enough to press gradually, but keep gains segmented.";
    lockSuggestion = {
      preset: "cliff7dVest90d",
      title: "7-day cliff with 90-day disciplined vest",
      cooldownDays: 90,
      protectedPct,
    };
    immediateActions = [
      "Pre-commit to a weekly profit skim instead of discretionary exits.",
      "Keep dry powder uncorrelated from the core thesis.",
      "Only scale if the next entries improve average basis, not just exposure.",
    ];
  }

  return {
    recoveryScore,
    runwayMonths,
    protectedCapitalUsd,
    riskBand,
    summary,
    immediateActions,
    lockSuggestion,
    checkpoints: [
      {
        label: "First green week",
        detail: "Move 25% of fresh profits into the protected bucket before increasing any trade size.",
      },
      {
        label: "Break-even stretch",
        detail: "If drawdown compresses below 10%, switch from defense to measured compounding.",
      },
      {
        label: "New equity highs",
        detail: "Refresh the lock plan instead of letting recovery risk drift back into the stack.",
      },
    ],
  };
}

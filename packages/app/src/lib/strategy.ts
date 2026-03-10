export type StrategyPresetKey = "panicLock7d" | "lock30d" | "cliff7dVest90d";

export type StrategyInputs = {
  bankrollUsd: number;
  targetProfitUsd: number;
  protectPct: number;
  cooldownDays: number;
  relapsesPerMonth: number;
  conviction: "fragile" | "steady" | "ice-cold";
};

export type StrategyScenario = {
  title: string;
  description: string;
  unlockedUsd: number;
  protectedUsd: number;
  posture: "danger" | "watch" | "safe";
};

export type StrategyPlan = {
  protectedUsd: number;
  tradingBufferUsd: number;
  disciplineScore: number;
  cooldownHours: number;
  relapseTaxUsd: number;
  recommendedPreset: StrategyPresetKey;
  presetReason: string;
  narrative: string;
  scenarios: StrategyScenario[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function buildStrategyPlan(inputs: StrategyInputs): StrategyPlan {
  const bankrollUsd = clamp(inputs.bankrollUsd, 100, 5_000_000);
  const targetProfitUsd = clamp(inputs.targetProfitUsd, 50, bankrollUsd);
  const requestedProtectPct = clamp(inputs.protectPct, 5, 95);
  const cooldownDays = clamp(inputs.cooldownDays, 1, 180);
  const relapsesPerMonth = clamp(inputs.relapsesPerMonth, 0, 30);
  const minimumProtectedUsd = roundMoney(targetProfitUsd);
  const protectedUsd = roundMoney(
    clamp(
      Math.max(bankrollUsd * (requestedProtectPct / 100), minimumProtectedUsd),
      0,
      bankrollUsd,
    ),
  );
  const effectiveProtectPct = (protectedUsd / bankrollUsd) * 100;

  const convictionModifier =
    inputs.conviction === "fragile" ? -14 : inputs.conviction === "steady" ? 0 : 12;

  const disciplineScore = clamp(
    Math.round(
      48 +
        effectiveProtectPct * 0.35 +
        cooldownDays * 0.55 -
        relapsesPerMonth * 3.8 +
        convictionModifier
    ),
    0,
    100,
  );

  const tradingBufferUsd = roundMoney(bankrollUsd - protectedUsd);
  const relapseTaxUsd = roundMoney(
    Math.min(tradingBufferUsd, tradingBufferUsd * (relapsesPerMonth / 6)),
  );

  let recommendedPreset: StrategyPresetKey = "panicLock7d";
  let presetReason = "Short, hard timeout to stop immediate revenge trading.";

  if (cooldownDays >= 30 && effectiveProtectPct >= 55) {
    recommendedPreset = "lock30d";
    presetReason = "You are protecting a meaningful chunk of the stack and want a full reset window.";
  }

  if (cooldownDays >= 60 && effectiveProtectPct >= 70) {
    recommendedPreset = "cliff7dVest90d";
    presetReason = "Your secured profit target needs a real cooling-off cliff plus a long glide path back into liquidity.";
  }

  const narrative =
    disciplineScore >= 80
      ? "This plan behaves like a vault first and a trading bankroll second."
      : disciplineScore >= 60
        ? "This plan gives you enough room to trade, but still forces a meaningful pause."
        : "This still leaves a lot of capital exposed to impulse redeploys. Lock more or wait longer.";

  const earlyRelapseUnlocked = roundMoney(tradingBufferUsd);
  const earlyRelapseProtected = roundMoney(protectedUsd);
  const twoDayLeak = roundMoney(Math.max(0, tradingBufferUsd - relapseTaxUsd * 0.45));
  const cleanWeekLiquidity = roundMoney(
    recommendedPreset === "panicLock7d"
      ? bankrollUsd
      : recommendedPreset === "lock30d"
        ? tradingBufferUsd + protectedUsd * 0.2
        : tradingBufferUsd,
  );

  const scenarios: StrategyScenario[] = [
    {
      title: "Immediate relaunch",
      description: "You ape back in within the same hour because the chart still looks hot.",
      unlockedUsd: earlyRelapseUnlocked,
      protectedUsd: earlyRelapseProtected,
      posture: effectiveProtectPct >= 70 ? "watch" : "danger",
    },
    {
      title: "48-hour tilt loop",
      description: "You keep taking stabs for two days trying to outplay the market.",
      unlockedUsd: twoDayLeak,
      protectedUsd: earlyRelapseProtected,
      posture: cooldownDays >= 14 ? "watch" : "danger",
    },
    {
      title: "Clean week",
      description: "You cool off, come back clear-headed, and only then decide what to deploy.",
      unlockedUsd: cleanWeekLiquidity,
      protectedUsd: roundMoney(Math.max(0, bankrollUsd - cleanWeekLiquidity)),
      posture: disciplineScore >= 65 ? "safe" : "watch",
    },
  ];

  return {
    protectedUsd,
    tradingBufferUsd,
    disciplineScore,
    cooldownHours: cooldownDays * 24,
    relapseTaxUsd,
    recommendedPreset,
    presetReason,
    narrative,
    scenarios,
  };
}

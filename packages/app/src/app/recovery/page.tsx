"use client";

import Link from "next/link";
import { useState } from "react";
import { Header } from "@/components/Header";
import { buildRecoveryPlan, type RecoveryProfile } from "@/lib/recovery";

type RangeInputProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (next: number) => void;
};

function RangeInput({ label, value, min, max, step, suffix = "", onChange }: RangeInputProps) {
  return (
    <label className="block space-y-3">
      <div className="flex items-center justify-between text-sm text-white/70">
        <span>{label}</span>
        <span className="font-semibold text-cyan">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-cyan"
      />
    </label>
  );
}

function ChoicePill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm transition-colors ${
        active
          ? "bg-cyan text-black"
          : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

const DEFAULT_PROFILE: RecoveryProfile = {
  bankrollUsd: 18000,
  drawdownPct: 34,
  monthlyBurnUsd: 2500,
  conviction: "steady",
  liquidityNeed: "medium",
};

export default function RecoveryPage() {
  const [profile, setProfile] = useState<RecoveryProfile>(DEFAULT_PROFILE);
  const plan = buildRecoveryPlan(profile);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,_rgba(0,229,255,0.16),_rgba(255,255,255,0.02)_44%,_rgba(255,255,255,0.01)_100%)] p-7 sm:p-9">
            <div className="mb-8 flex flex-col gap-4">
              <span className="inline-flex w-fit items-center rounded-full border border-cyan/30 bg-cyan/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan">
                Recovery Lab
              </span>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                  Model your comeback before you lock the gains.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
                  Stress-test how much capital to quarantine after a drawdown, when to lean defensive, and what lock
                  setup best matches the recovery pace you are actually trying to survive.
                </p>
              </div>
            </div>

            <div className="grid gap-5 rounded-[24px] border border-white/[0.08] bg-black/30 p-5 sm:grid-cols-2">
              <RangeInput
                label="Trading bankroll"
                value={profile.bankrollUsd}
                min={5000}
                max={100000}
                step={1000}
                onChange={(bankrollUsd) => setProfile((current) => ({ ...current, bankrollUsd }))}
              />
              <RangeInput
                label="Current drawdown"
                value={profile.drawdownPct}
                min={5}
                max={80}
                step={1}
                suffix="%"
                onChange={(drawdownPct) => setProfile((current) => ({ ...current, drawdownPct }))}
              />
              <RangeInput
                label="Monthly burn"
                value={profile.monthlyBurnUsd}
                min={500}
                max={10000}
                step={100}
                onChange={(monthlyBurnUsd) => setProfile((current) => ({ ...current, monthlyBurnUsd }))}
              />
              <div className="space-y-3">
                <div className="text-sm text-white/70">Need access to capital soon?</div>
                <div className="flex flex-wrap gap-2">
                  {(["high", "medium", "low"] as const).map((item) => (
                    <ChoicePill
                      key={item}
                      active={profile.liquidityNeed === item}
                      onClick={() => setProfile((current) => ({ ...current, liquidityNeed: item }))}
                    >
                      {item}
                    </ChoicePill>
                  ))}
                </div>
              </div>
              <div className="space-y-3 sm:col-span-2">
                <div className="text-sm text-white/70">How strong is your conviction in the underlying thesis?</div>
                <div className="flex flex-wrap gap-2">
                  {(["fragile", "steady", "strong"] as const).map((item) => (
                    <ChoicePill
                      key={item}
                      active={profile.conviction === item}
                      onClick={() => setProfile((current) => ({ ...current, conviction: item }))}
                    >
                      {item}
                    </ChoicePill>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-7 sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-white/45">Recovery score</p>
                <h2 className="mt-3 text-6xl font-black tracking-tight text-white">{plan.recoveryScore}</h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                  plan.riskBand === "stabilize"
                    ? "bg-amber-400/15 text-amber-200"
                    : plan.riskBand === "press"
                      ? "bg-emerald-400/15 text-emerald-200"
                      : "bg-cyan/15 text-cyan"
                }`}
              >
                {plan.riskBand}
              </span>
            </div>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/64">{plan.summary}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/40">Runway</div>
                <div className="mt-3 text-3xl font-bold text-white">{plan.runwayMonths}m</div>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/40">Protected capital</div>
                <div className="mt-3 text-3xl font-bold text-white">${plan.protectedCapitalUsd.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/40">Cooldown</div>
                <div className="mt-3 text-3xl font-bold text-white">{plan.lockSuggestion.cooldownDays}d</div>
              </div>
            </div>

            <div className="mt-8 rounded-[24px] border border-cyan/25 bg-cyan/[0.07] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan/80">Recommended lock setup</div>
                  <h3 className="mt-2 text-2xl font-bold text-white">{plan.lockSuggestion.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    Protect roughly {plan.lockSuggestion.protectedPct}% of your bankroll while you rebuild consistency.
                  </p>
                </div>
                <Link
                  href={`/create?preset=${plan.lockSuggestion.preset}&amount=${Math.max(50, Math.round(plan.protectedCapitalUsd / 4))}`}
                  className="inline-flex items-center justify-center rounded-full bg-cyan px-5 py-3 text-sm font-semibold text-black transition-transform hover:-translate-y-0.5"
                >
                  Open in lock builder
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-7">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">Immediate actions</div>
            <ul className="mt-5 space-y-4">
              {plan.immediateActions.map((item) => (
                <li key={item} className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-4 text-sm leading-6 text-white/72">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">Recovery checkpoints</div>
                <h2 className="mt-3 text-2xl font-bold text-white">What to watch as the plan starts working</h2>
              </div>
              <Link href="/vaults" className="text-sm font-semibold text-cyan hover:text-cyan/80">
                View existing locks
              </Link>
            </div>
            <div className="mt-6 grid gap-4">
              {plan.checkpoints.map((checkpoint, index) => (
                <div key={checkpoint.label} className="grid gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-5 sm:grid-cols-[auto,1fr]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan/[0.12] text-sm font-bold text-cyan">
                    0{index + 1}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">{checkpoint.label}</div>
                    <p className="mt-1 text-sm leading-6 text-white/62">{checkpoint.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

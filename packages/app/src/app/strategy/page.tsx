"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { buildStrategyPlan, formatUsd, type StrategyInputs } from "@/lib/strategy";

type Conviction = StrategyInputs["conviction"];

const CONVICTION_OPTIONS: Array<{
  value: Conviction;
  label: string;
  description: string;
}> = [
  {
    value: "fragile",
    label: "Fragile",
    description: "You know exactly how the next candle can talk you into a bad re-entry.",
  },
  {
    value: "steady",
    label: "Steady",
    description: "You can hold a plan if the market goes sideways for a while.",
  },
  {
    value: "ice-cold",
    label: "Ice cold",
    description: "You are mostly sizing protection, not fighting panic behavior.",
  },
];

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.08]";
  if (score >= 60) return "text-cyan border-cyan/30 bg-cyan/[0.08]";
  return "text-amber-300 border-amber-300/25 bg-amber-300/[0.08]";
}

function postureTone(posture: "danger" | "watch" | "safe") {
  if (posture === "safe") return "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200";
  if (posture === "watch") return "border-cyan/20 bg-cyan/[0.06] text-cyan";
  return "border-rose-400/20 bg-rose-400/[0.06] text-rose-200";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] tracking-[0.18em] uppercase text-white/35">{children}</label>;
}

export default function StrategyPage() {
  const [bankrollUsd, setBankrollUsd] = useState(6400);
  const [targetProfitUsd, setTargetProfitUsd] = useState(1800);
  const [protectPct, setProtectPct] = useState(68);
  const [cooldownDays, setCooldownDays] = useState(21);
  const [relapsesPerMonth, setRelapsesPerMonth] = useState(4);
  const [conviction, setConviction] = useState<Conviction>("steady");

  const plan = useMemo(
    () =>
      buildStrategyPlan({
        bankrollUsd,
        targetProfitUsd,
        protectPct,
        cooldownDays,
        relapsesPerMonth,
        conviction,
      }),
    [bankrollUsd, targetProfitUsd, protectPct, cooldownDays, relapsesPerMonth, conviction],
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="px-5 sm:px-8 py-10 sm:py-14">
        <div className="max-w-6xl mx-auto space-y-10">
          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="card-gradient rounded-[28px] p-7 sm:p-9 space-y-6 overflow-hidden relative">
              <div className="absolute -top-20 right-[-30px] w-56 h-56 rounded-full bg-cyan/[0.08] blur-[70px] pointer-events-none" />
              <div className="relative space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan/15 bg-cyan/[0.06] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.22em] text-cyan">
                  Exit Strategy Lab
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-[3.2rem] font-bold leading-[1.02] tracking-tight">
                    Build the lock plan your future self won&apos;t negotiate with.
                  </h1>
                  <p className="max-w-2xl text-white/55 leading-relaxed">
                    This isn&apos;t yield optimization. It&apos;s damage containment for a wallet that just had a good day. Tune how much
                    you lock, how long you disappear, and how much dry powder you leave on the table.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/30">Protected now</div>
                    <div className="mt-2 text-2xl font-semibold">{formatUsd(plan.protectedUsd)}</div>
                    <div className="mt-1 text-sm text-white/45">Moved out of reach the moment you lock it.</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/30">Trading buffer</div>
                    <div className="mt-2 text-2xl font-semibold">{formatUsd(plan.tradingBufferUsd)}</div>
                    <div className="mt-1 text-sm text-white/45">Still liquid if you insist on touching the stove again.</div>
                  </div>
                  <div className={`rounded-2xl border p-4 ${scoreTone(plan.disciplineScore)}`}>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-current/70">Discipline score</div>
                    <div className="mt-2 text-2xl font-semibold">{plan.disciplineScore}/100</div>
                    <div className="mt-1 text-sm text-current/80">{plan.narrative}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-cyan/15 bg-gradient-to-b from-cyan/[0.08] to-transparent p-7 sm:p-8 space-y-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-cyan/70">Recommended lock setup</div>
                <h2 className="mt-3 text-2xl font-semibold">{plan.recommendedSetupLabel}</h2>
                <p className="mt-2 text-white/55 leading-relaxed">{plan.presetReason}</p>
                <p className="mt-2 text-sm text-white/40">{plan.recommendedSetupDescription}</p>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/45">Cooldown window</div>
                    <div className="text-xl font-semibold">{cooldownDays} days</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white/45">Relapse tax</div>
                    <div className="text-xl font-semibold">{formatUsd(plan.relapseTaxUsd)}</div>
                  </div>
                </div>
                <div className="text-sm text-white/45">
                  That&apos;s the amount your current setup still leaves exposed to sloppy revenge trades each month.
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href={plan.recommendedSetupHref}
                  className="bg-cyan text-black font-bold rounded-xl px-5 py-4 text-center hover:bg-cyan/90 transition-all hover:shadow-[0_0_40px_rgba(0,229,255,0.25)]"
                >
                  Build This Lock Plan
                </Link>
                <Link
                  href="/create"
                  className="rounded-xl border border-white/[0.1] px-5 py-4 text-center text-white/65 hover:border-cyan/30 hover:text-cyan transition-colors"
                >
                  Build a custom lock instead
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="card-gradient rounded-[28px] p-6 sm:p-7 space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Tune your constraints</h2>
                <p className="text-sm text-white/45">This is less about perfect numbers and more about being honest about your own behavior.</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <FieldLabel>Current bankroll</FieldLabel>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={bankrollUsd}
                    onChange={(event) => setBankrollUsd(Number(event.target.value) || 0)}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-base outline-none focus:border-cyan/40"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Profit you want to secure</FieldLabel>
                  <input
                    type="number"
                    min={50}
                    step={50}
                    value={targetProfitUsd}
                    onChange={(event) => setTargetProfitUsd(Number(event.target.value) || 0)}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-base outline-none focus:border-cyan/40"
                  />
                  <div className="text-xs text-white/35">
                    The planner protects at least this amount, even if your percent slider is lower.
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel>Percent to protect immediately</FieldLabel>
                    <span className="text-sm font-semibold text-cyan">{protectPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={protectPct}
                    onChange={(event) => setProtectPct(Number(event.target.value))}
                    className="w-full accent-cyan"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <FieldLabel>Cooldown</FieldLabel>
                      <span className="text-sm font-semibold text-cyan">{cooldownDays}d</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={120}
                      value={cooldownDays}
                      onChange={(event) => setCooldownDays(Number(event.target.value))}
                      className="w-full accent-cyan"
                    />
                    <div className="text-xs text-white/35">{plan.cooldownHours} hours between your current self and unlocked size.</div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <FieldLabel>Tilt episodes / month</FieldLabel>
                      <span className="text-sm font-semibold text-cyan">{relapsesPerMonth}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      value={relapsesPerMonth}
                      onChange={(event) => setRelapsesPerMonth(Number(event.target.value))}
                      className="w-full accent-cyan"
                    />
                    <div className="text-xs text-white/35">Brutal honesty beats fake confidence here.</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <FieldLabel>How much do you trust your future self?</FieldLabel>
                  <div className="grid gap-3">
                    {CONVICTION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setConviction(option.value)}
                        className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                          conviction === option.value
                            ? "border-cyan/35 bg-cyan/[0.08]"
                            : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14]"
                        }`}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="mt-1 text-sm text-white/45 leading-relaxed">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <section className="card-gradient rounded-[28px] p-6 sm:p-7 space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Scenario pressure test</h2>
                  <p className="text-sm text-white/45 mt-1">How much stays out of reach when your discipline breaks at predictable moments?</p>
                </div>

                <div className="grid gap-4">
                  {plan.scenarios.map((scenario) => (
                    <div key={scenario.title} className={`rounded-2xl border p-5 ${postureTone(scenario.posture)}`}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="text-lg font-semibold">{scenario.title}</div>
                          <p className="max-w-xl text-sm leading-relaxed text-white/60">{scenario.description}</p>
                        </div>
                        <div className="sm:text-right">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Still locked</div>
                          <div className="mt-1 text-2xl font-semibold">{formatUsd(scenario.protectedUsd)}</div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm text-white/50">
                        <span>Liquid to redeploy</span>
                        <span className="font-semibold text-white/75">{formatUsd(scenario.unlockedUsd)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card-gradient rounded-[28px] p-6 sm:p-7 space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">What this plan is saying</h2>
                  <p className="text-sm text-white/45 mt-1">A decent lock plan should sound a little stricter than your internal monologue wants it to.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/30">1</div>
                    <p className="mt-3 text-sm text-white/60 leading-relaxed">
                      Protect at least <span className="font-semibold text-white">{formatUsd(plan.protectedUsd)}</span> right now so the win survives your next impulse.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/30">2</div>
                    <p className="mt-3 text-sm text-white/60 leading-relaxed">
                      Force a <span className="font-semibold text-white">{cooldownDays}-day</span> cooling-off period before meaningful liquidity comes back.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/30">3</div>
                    <p className="mt-3 text-sm text-white/60 leading-relaxed">
                      Leave only <span className="font-semibold text-white">{formatUsd(plan.tradingBufferUsd)}</span> exposed if you insist on staying in the arena.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

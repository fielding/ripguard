"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { analyzeRebalance, type RebalanceInput } from "@/lib/rebalance";

const DEFAULT_INPUT: RebalanceInput = {
  stablePct: 25,
  convictionPct: 40,
  speculativePct: 20,
  dryPowderPct: 15,
  volatility: "mixed",
  horizon: "mid",
};

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-3">
      <div className="flex items-center justify-between text-sm text-white/70">
        <span>{label}</span>
        <span className="font-semibold text-cyan">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-cyan"
      />
    </label>
  );
}

function Pill({
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

export default function RebalancePage() {
  const [input, setInput] = useState<RebalanceInput>(DEFAULT_INPUT);
  const result = useMemo(() => analyzeRebalance(input), [input]);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8">
        <section className="grid gap-6 lg:grid-cols-[1fr,0.95fr]">
          <div className="rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,_rgba(0,229,255,0.14),_rgba(255,255,255,0.02)_45%,_rgba(255,255,255,0.01)_100%)] p-7 sm:p-9">
            <span className="inline-flex rounded-full border border-cyan/30 bg-cyan/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan">
              Rebalance Compass
            </span>
            <div className="mt-6 space-y-3">
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                See when your stack stopped being a portfolio and became a bet.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
                Model how much of your capital sits in stable reserve, conviction exposure, speculative reach, and real
                dry powder. Then convert that drift into a lock recommendation before stress does it for you.
              </p>
            </div>

            <div className="mt-8 grid gap-5 rounded-[24px] border border-white/[0.08] bg-black/25 p-5 sm:grid-cols-2">
              <Slider
                label="Stable reserve"
                value={input.stablePct}
                onChange={(stablePct) => setInput((current) => ({ ...current, stablePct }))}
              />
              <Slider
                label="Conviction positions"
                value={input.convictionPct}
                onChange={(convictionPct) => setInput((current) => ({ ...current, convictionPct }))}
              />
              <Slider
                label="Speculative sleeve"
                value={input.speculativePct}
                onChange={(speculativePct) => setInput((current) => ({ ...current, speculativePct }))}
              />
              <Slider
                label="Dry powder"
                value={input.dryPowderPct}
                onChange={(dryPowderPct) => setInput((current) => ({ ...current, dryPowderPct }))}
              />

              <div className="space-y-3 sm:col-span-2">
                <div className="text-sm text-white/70">Market regime</div>
                <div className="flex flex-wrap gap-2">
                  {(["calm", "mixed", "chaotic"] as const).map((item) => (
                    <Pill
                      key={item}
                      active={input.volatility === item}
                      onClick={() => setInput((current) => ({ ...current, volatility: item }))}
                    >
                      {item}
                    </Pill>
                  ))}
                </div>
              </div>

              <div className="space-y-3 sm:col-span-2">
                <div className="text-sm text-white/70">Expected holding horizon</div>
                <div className="flex flex-wrap gap-2">
                  {(["short", "mid", "long"] as const).map((item) => (
                    <Pill
                      key={item}
                      active={input.horizon === item}
                      onClick={() => setInput((current) => ({ ...current, horizon: item }))}
                    >
                      {item}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-7 sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-white/45">Exposure state</p>
                <h2 className="mt-3 text-5xl font-black tracking-tight text-white">{result.dangerLevel}</h2>
              </div>
              <div className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Total: {result.totalPct}%
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/40">Allocation drift</div>
                <div className="mt-3 text-3xl font-bold text-white">{result.imbalancePct}%</div>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/40">Suggested preset</div>
                <div className="mt-3 text-3xl font-bold text-white">{result.suggestedPreset}</div>
              </div>
            </div>

            <div className="mt-8 rounded-[24px] border border-cyan/25 bg-cyan/[0.07] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan/80">Primary move</div>
              <h3 className="mt-3 text-2xl font-bold text-white">{result.primaryMove}</h3>
              <p className="mt-3 text-sm leading-6 text-white/68">{result.guidance}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/create?preset=${result.suggestedPreset}&amount=250`}
                  className="inline-flex items-center justify-center rounded-full bg-cyan px-5 py-3 text-sm font-semibold text-black transition-transform hover:-translate-y-0.5"
                >
                  Open lock plan
                </Link>
                <Link
                  href="/vaults"
                  className="inline-flex items-center justify-center rounded-full border border-white/[0.08] px-5 py-3 text-sm font-semibold text-white/75 hover:border-white/[0.14] hover:text-white"
                >
                  Compare current vaults
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">Checklist</div>
              <h2 className="mt-3 text-2xl font-bold text-white">What to do before you add risk again</h2>
            </div>
            <div className="text-sm text-white/45">Designed for portfolio triage, not prediction.</div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {result.checklist.map((item) => (
              <div key={item} className="rounded-2xl border border-white/[0.06] bg-black/20 p-5 text-sm leading-6 text-white/68">
                {item}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

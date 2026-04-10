"use client";

import { PRESETS, SABLIER_LOCKUP, EXPLORER_URL, IS_TESTNET } from "@/config/contracts";
import Link from "next/link";
import { Header } from "@/components/Header";
import { WelcomeModal } from "@/components/WelcomeModal";
import { RipGuardLockup, RipGuardMark } from "@/components/Brand";

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-cyan shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

const PRESET_ICONS: Record<string, React.ReactNode> = {
  hourly1d: <ClockIcon className="w-7 h-7 text-cyan" />,
  hourly3d: <ClockIcon className="w-7 h-7 text-cyan" />,
  hourly1w: <ClockIcon className="w-7 h-7 text-cyan" />,
  daily1w: <ClockIcon className="w-7 h-7 text-cyan" />,
  panicLock1d: <ShieldIcon className="w-7 h-7 text-cyan" />,
  panicThenDaily: <LockIcon className="w-7 h-7 text-cyan" />,
};

const HERO_PROOF_POINTS = [
  "Self-custodial",
  "Non-cancelable",
  "Base mainnet",
  "Powered by Sablier",
];

const HERO_STATS = [
  { value: "$3B+", label: "Processed by Sablier" },
  { value: "4x", label: "Independently audited" },
  { value: "0", label: "Custom contracts" },
  { value: "100%", label: "Non-custodial flow" },
];

function FAQItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border border-white/[0.06] rounded-2xl bg-white/[0.02] hover:border-white/[0.12] transition-colors">
      <summary className="cursor-pointer px-6 py-5 font-semibold text-white/90 list-none flex items-center justify-between text-[15px] focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-[-2px] focus-visible:rounded-2xl">
        {question}
        <svg
          className="w-5 h-5 text-white/20 group-open:rotate-180 transition-transform duration-200"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-6 pb-6 text-sm text-white/55 space-y-3 leading-relaxed">
        {children}
      </div>
    </details>
  );
}

export default function Home() {
  const sablierExplorerUrl = `${EXPLORER_URL}/address/${SABLIER_LOCKUP}`;
  const githubUrl = "https://github.com/fielding/ripguard";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <WelcomeModal />
      <Header />

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-5 pt-20 pb-20 sm:px-8 sm:pt-24 sm:pb-24">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(10,69,79,0.55),transparent_34%),linear-gradient(180deg,#071015_0%,#06090c_56%,#050608_100%)]" />
            <div className="absolute inset-0 hero-grid" />
            <div className="absolute left-1/2 top-[-8%] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-cyan/[0.08] blur-[140px]" />
            <div className="absolute right-[6%] top-[22%] h-40 w-40 rounded-full bg-cyan/[0.08] blur-[90px]" />
          </div>

          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="max-w-2xl">
              <div className="surface-pill mb-6 text-[11px] font-semibold uppercase tracking-[0.28em]">
                Built on Sablier&apos;s audited contracts
              </div>

              <RipGuardLockup className="mb-7" />

              <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-[4.35rem] sm:leading-[0.98]">
                Lock your winnings before you give them back.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-white/62 sm:text-lg">
                The &ldquo;I&apos;m up, get me out&rdquo; button for Base traders. Send USDC
                straight into the{" "}
                <a
                  href="https://sablier.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan underline decoration-cyan/35 hover:decoration-cyan/65 transition-colors"
                >
                  Sablier protocol
                </a>{" "}
                with a schedule you choose, so future-you can&apos;t instantly ape back in.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/create" className="button-primary px-7 text-base sm:px-8 sm:text-lg">
                  Create a Lock
                </Link>
                <a
                  href={sablierExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-secondary px-7 text-base sm:px-8 sm:text-lg"
                >
                  View Contract
                </a>
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {HERO_PROOF_POINTS.map((point) => (
                  <span key={point} className="surface-pill text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_12px_rgba(71,180,204,0.45)]" />
                    {point}
                  </span>
                ))}
              </div>

              {!IS_TESTNET && (
                <a
                  href="https://testnet.ripguard.xyz"
                  className="mt-5 inline-flex text-sm text-white/34 hover:text-cyan/75 transition-colors"
                >
                  Want to test the flow first? Use the testnet version &rarr;
                </a>
              )}
            </div>

            <div className="relative">
              <div className="hero-stage p-5 sm:p-6">
                <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-black/20 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-white/35">
                  <span>RipGuard Vault Engine</span>
                  <span>Base Mainnet</span>
                </div>

                <div className="relative mt-5 overflow-hidden rounded-[1.6rem] border border-cyan/12 bg-[linear-gradient(180deg,rgba(6,20,25,0.92)_0%,rgba(4,10,13,0.98)_100%)] px-6 py-8 sm:px-8">
                  <div className="absolute left-1/2 top-4 h-44 w-44 -translate-x-1/2 rounded-full bg-cyan/[0.12] blur-[80px]" />
                  <div className="relative flex flex-col items-center text-center">
                    <div className="animate-float">
                      <RipGuardMark className="h-32 w-32 sm:h-36 sm:w-36" />
                    </div>
                    <p className="mt-5 text-sm uppercase tracking-[0.3em] text-white/28">
                      Discipline, enforced on-chain
                    </p>
                    <p className="mt-3 max-w-sm text-sm leading-7 text-white/52">
                      Your USDC routes directly into Sablier Lockup. No RipGuard custody.
                      No admin override. No cancel path.
                    </p>
                  </div>

                  <div className="relative mt-7 grid gap-3">
                    {Object.entries(PRESETS).map(([key, preset]) => (
                      <Link
                        key={key}
                        href={`/create?preset=${key}`}
                        className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5 text-left transition-colors hover:border-cyan/24 hover:bg-cyan/[0.05]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan/15 bg-cyan/[0.08]">
                            {PRESET_ICONS[key]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white/88">{preset.label}</p>
                            <p className="text-xs text-white/38">{preset.description}</p>
                          </div>
                        </div>
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-cyan/72">
                          Launch
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mx-auto mt-10 grid max-w-6xl gap-3 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="hero-stat-card">
                <div className="text-2xl font-semibold tracking-[-0.05em] text-white">{stat.value}</div>
                <div className="mt-1 text-sm text-white/42">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Problem Section */}
        <section className="px-5 sm:px-8 py-24 sm:py-32 section-divider">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-2xl sm:text-4xl font-bold leading-snug">
              You don&apos;t need better alpha.
              <br />
              <span className="text-cyan text-glow-cyan">You need a circuit breaker.</span>
            </h2>
            <div className="text-white/50 space-y-5 text-base sm:text-lg leading-relaxed">
              <p>
                You know the pattern: Win &rarr; confidence spike &rarr;
                &ldquo;one more play&rdquo; &rarr; give it all back.
              </p>
              <p className="text-white/60 font-medium text-lg sm:text-xl">
                RipGuard is the &ldquo;I&apos;m up, lock it now&rdquo; button.
              </p>
              <p>
                It&apos;s not a promise. It&apos;s not yield. It&apos;s not
                custody.
                <br />
                It&apos;s just code that makes your future self behave.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="px-5 sm:px-8 py-24 sm:py-28 section-divider relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[800px] h-[400px] rounded-full bg-cyan/[0.03] blur-[120px]" />
          </div>
          <div className="relative z-10 max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
              Lock. Chill. Collect.
            </h2>
            <p className="text-center text-white/45 mb-16 text-sm max-w-md mx-auto">
              No accounts. No middleman. Your funds go directly into the Sablier
              protocol — not a RipGuard contract.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
              <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="step-circle">1</div>
                <div className="step-connector" />
                <h3 className="font-semibold text-lg">Deposit your winnings</h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  Choose how much USDC to protect. You already did the hard
                  part — you won.
                </p>
              </div>
              <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="step-circle">2</div>
                <div className="step-connector" />
                <h3 className="font-semibold text-lg">Pick a schedule</h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  Lump sum on a date, cliff + vesting, or drip over time.
                  You&apos;re choosing{" "}
                  <span className="text-white/65 italic">
                    when you&apos;re allowed to touch it
                  </span>
                  .
                </p>
              </div>
              <div className="relative flex flex-col items-center text-center space-y-4">
                <div className="step-circle">3</div>
                <h3 className="font-semibold text-lg">Claim when it unlocks</h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  Time passes, you claim to your wallet. No one else can touch
                  it. No cancel button. No exceptions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Preset Cards */}
        <section className="px-5 sm:px-8 py-24 sm:py-28 section-divider">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
              Choose your schedule
            </h2>
            <p className="text-center text-white/50 mb-12 text-sm">
              Presets built for how degens actually trade.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <Link
                  key={key}
                  href={`/create?preset=${key}`}
                  className="card-gradient rounded-2xl p-7 text-center group flex flex-col items-center gap-5 hover:translate-y-[-2px] transition-all duration-300 focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2"
                >
                  <div className="w-14 h-14 rounded-full border border-cyan/15 bg-cyan/[0.06] flex items-center justify-center group-hover:border-cyan/30 group-hover:bg-cyan/10 group-hover:shadow-[0_0_24px_rgba(71,180,204,0.15)] transition-all duration-300">
                    {PRESET_ICONS[key]}
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg group-hover:text-cyan transition-colors">
                      {preset.label}
                    </h3>
                    <p className="text-sm text-white/50 leading-relaxed">{preset.description}</p>
                  </div>
                  <span className="text-xs text-white/20 group-hover:text-cyan/50 transition-colors mt-auto">
                    Select &rarr;
                  </span>
                </Link>
              ))}
            </div>

            <div className="text-center mt-8">
              <Link
                href="/create"
                className="text-sm text-white/35 hover:text-cyan transition-colors underline decoration-white/15 hover:decoration-cyan/40"
              >
                Or build a custom schedule
              </Link>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section id="trust" className="px-5 sm:px-8 py-24 sm:py-28 section-divider">
          <div className="max-w-5xl mx-auto space-y-14">
            <div className="text-center space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold">
                Zero custom contracts. Zero custody.
              </h2>
              <p className="text-white/55 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                RipGuard does not custody funds. All locks are created directly
                in the Sablier protocol.
              </p>
              <p className="text-white/40 text-sm max-w-xl mx-auto leading-relaxed">
                When you lock, your USDC goes straight from your wallet into
                Sablier — an immutable, audited, battle-tested protocol with
                real TVL. No RipGuard contract ever touches your funds.
              </p>
            </div>

            {/* Trust Bullets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: "Direct to Sablier", desc: "Your funds go straight into the Sablier protocol. No RipGuard contract in the middle." },
                { title: "Immutable contracts", desc: "Sablier contracts are immutable. No proxy upgrades. No admin keys. No upgrade risk." },
                { title: "Non-cancelable locks", desc: "Locks are non-cancelable and non-transferable. Nobody — not even you — can rug it early." },
                { title: "Only you receive funds", desc: "Withdrawals always pay your wallet address. No admin drain function exists." },
                { title: "Transparent fees", desc: "0.5% fee collected by Sablier during lock creation and sent to the RipGuard treasury. Shown before you sign." },
                { title: "Site goes down? You\u2019re fine.", desc: "Your lock lives in Sablier. Interact directly via BaseScan anytime." },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 card-gradient rounded-xl p-5">
                  <CheckIcon />
                  <div>
                    <h3 className="font-semibold text-sm">{item.title}</h3>
                    <p className="text-xs text-white/45 mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Verify in 60 seconds */}
            <div className="border border-cyan/15 rounded-2xl p-7 sm:p-8 bg-gradient-to-b from-cyan/[0.06] to-transparent">
              <h3 className="font-bold text-lg mb-5">
                Verify it in 60 seconds
              </h3>
              <ol className="space-y-4 text-sm text-white/55">
                <li className="flex gap-3">
                  <span className="text-cyan font-bold shrink-0">1.</span>
                  <span>
                    Click{" "}
                    <a
                      href={sablierExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan underline decoration-cyan/30"
                    >
                      View Contract
                    </a>{" "}
                    — this is Sablier&apos;s official Lockup contract on Base.
                    Verified, immutable, no proxy.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-cyan font-bold shrink-0">2.</span>
                  <span>
                    Confirm there is no admin withdrawal path and no upgrade
                    mechanism. RipGuard has no custom contract — it&apos;s all
                    Sablier.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-cyan font-bold shrink-0">3.</span>
                  <span>
                    Try a small test lock first (seriously &mdash; start with
                    $5).
                  </span>
                </li>
              </ol>
              <p className="text-xs text-white/25 mt-5">
                If you&apos;re the type to read code, the repo is on{" "}
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan/50 underline"
                >
                  GitHub
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        {/* What we can and can't do */}
        <section className="px-5 sm:px-8 py-24 sm:py-28 section-divider">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
              What we can and can&apos;t do
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="rounded-2xl p-7 space-y-5 border border-emerald-500/10 bg-gradient-to-b from-emerald-500/[0.06] to-transparent">
                <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  We can
                </h3>
                <ul className="text-sm text-white/55 space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="text-emerald-500/60 mt-1 shrink-0">&bull;</span>
                    Show you a clean UI for creating Sablier locks
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-emerald-500/60 mt-1 shrink-0">&bull;</span>
                    Collect the 0.5% fee shown before you sign
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-emerald-500/60 mt-1 shrink-0">&bull;</span>
                    Shut down the site (your locks still work)
                  </li>
                </ul>
              </div>
              <div className="rounded-2xl p-7 space-y-5 border border-red-500/10 bg-gradient-to-b from-red-500/[0.06] to-transparent">
                <h3 className="font-semibold text-red-400 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  We can&apos;t
                </h3>
                <ul className="text-sm text-white/55 space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500/60 mt-1 shrink-0">&bull;</span>
                    Access your funds
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500/60 mt-1 shrink-0">&bull;</span>
                    Withdraw early on your behalf
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500/60 mt-1 shrink-0">&bull;</span>
                    Change unlock rules after lock
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500/60 mt-1 shrink-0">&bull;</span>
                    Move funds anywhere except your wallet
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Founder Section */}
        <section className="px-5 sm:px-8 py-24 sm:py-28 section-divider">
          <div className="max-w-3xl mx-auto text-center space-y-7">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Built by a degen who needed this.
            </h2>
            <div className="text-white/55 space-y-4 leading-relaxed">
              <p>
                I turned $800 into $22k on a memecoin. Two days later I had
                $1,200. Not because the market moved — because I did.
              </p>
              <p>
                You know the feeling. You hit a big win. Your brain goes
                &ldquo;I&apos;m unstoppable.&rdquo; One more trade&hellip; then
                another&hellip; then the whole bag is gone.
              </p>
              <p>
                The problem isn&apos;t intelligence. It&apos;s{" "}
                <span className="text-white font-semibold">tilt</span>. And
                willpower doesn&apos;t fix tilt — only constraints do.
              </p>
              <p>
                RipGuard is the tool I wish existed during those moments — a way
                to lock winnings on-chain so your future self can&apos;t YOLO
                them back.
              </p>
              <p className="text-white/25 text-sm">
                If you don&apos;t trust the website, that&apos;s fine —{" "}
                <a
                  href={sablierExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan/50 underline"
                >
                  verify the contract yourself
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Fees & Audit Fund */}
        <section className="px-5 sm:px-8 py-24 sm:py-28 section-divider">
          <div className="max-w-3xl mx-auto text-center space-y-7">
            <h2 className="text-2xl sm:text-3xl font-bold">
              0.5% fee. Collected by Sablier. Sent to our treasury.
            </h2>
            <p className="text-white/55 leading-relaxed">
              RipGuard charges a 0.5% lock creation fee via Sablier&apos;s
              native broker mechanism. During stream creation, Sablier
              automatically splits your deposit: locked amount goes to the
              protocol, fee goes to the RipGuard treasury. Your funds never
              touch RipGuard infrastructure.
            </p>
            <p className="text-sm text-white/25">
              No hidden withdraw fees. No subscriptions. One transparent fee
              when you lock. Treasury address is public and on-chain.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-5 sm:px-8 py-24 sm:py-28 section-divider">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">FAQ</h2>

            <FAQItem question={`"Can RipGuard rug me?"`}>
              <p>
                RipGuard never touches your funds. Locks are created directly in
                the Sablier protocol — an immutable, audited contract with no
                admin keys.
              </p>
              <p>
                We don&apos;t deploy custom contracts. There is no RipGuard
                contract that holds your funds. Sablier enforces the lock rules
                and only your wallet can withdraw.
              </p>
              <p className="text-white/25">
                Reality check: all smart contracts carry risk. Start small and
                verify the Sablier contract yourself on BaseScan.
              </p>
            </FAQItem>

            <FAQItem question={`"What if RipGuard goes offline?"`}>
              <p>
                Your lock lives in Sablier, not on our servers. You can always:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Claim directly through BaseScan</li>
                <li>Use the Sablier app or any compatible interface</li>
              </ul>
            </FAQItem>

            <FAQItem question={`"Is this an investment product?"`}>
              <p>
                No. RipGuard doesn&apos;t generate yield, promise returns, or
                do anything with your funds. It&apos;s a time lock.
                You put USDC in, time passes, you take USDC out. That&apos;s it.
              </p>
            </FAQItem>

            <FAQItem
              question={`"Why would I pay the fee instead of doing this myself?"`}
            >
              <p>Because RipGuard makes it effortless:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Degen-native presets</li>
                <li>Proof-of-lock receipts</li>
                <li>Dashboard to track all your vaults</li>
              </ul>
              <p>The 0.5% keeps the lights on. There are no custom contracts to audit — Sablier is already battle-tested and audited.</p>
            </FAQItem>

            <FAQItem question={`"Can I unlock early if I really need it?"`}>
              <p>
                No. That&apos;s the point. If you need flexibility, don&apos;t
                lock it.
              </p>
            </FAQItem>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="px-5 sm:px-8 py-28 sm:py-40 section-divider relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[600px] rounded-full bg-cyan/[0.05] blur-[160px]" />
          </div>
          <div className="absolute inset-0 grid-overlay pointer-events-none" />
          <div className="relative z-10 max-w-2xl mx-auto text-center space-y-7">
            <p className="text-sm text-white/30 border border-white/[0.06] rounded-xl px-5 py-3.5 inline-block bg-white/[0.02] backdrop-blur-sm">
              New here? Try locking $5 first and see how it works.
            </p>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Stop giving back your gains.
            </h2>
            <p className="text-white/50 text-lg sm:text-xl">
              You already know you need this. Lock now, thank yourself later.
            </p>
            <div>
              <Link
                href="/create"
                className="button-primary px-10 text-lg"
              >
                Create a Lock
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-5 sm:px-8 py-12 section-divider text-center space-y-5">
          <div className="flex items-center justify-center gap-2 text-white/20">
            <RipGuardMark className="h-5 w-5" />
            <span className="text-xs font-semibold tracking-tight">RipGuard</span>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-white/30">
            <Link
              href="/vaults"
              className="hover:text-white/60 transition-colors"
            >
              My Vaults
            </Link>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/60 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://x.com/ripguardxyz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/60 transition-colors"
            >
              X
            </a>
            <a
              href={sablierExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/60 transition-colors"
            >
              BaseScan
            </a>
          </div>
          <p className="text-xs text-white/15 max-w-md mx-auto leading-relaxed">
            RipGuard does not custody funds — all locks are created directly in
            Sablier&apos;s audited protocol on Base. Non-custodial. Immutable.
            This is not financial advice. DYOR. 0.5% broker fee collected
            via Sablier&apos;s native mechanism.
          </p>
        </footer>
      </main>
    </div>
  );
}

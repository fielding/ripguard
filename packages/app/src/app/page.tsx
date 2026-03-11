"use client";

import { PRESETS, SABLIER_LOCKUP, EXPLORER_URL, IS_TESTNET } from "@/config/contracts";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/Header";
import { WelcomeModal } from "@/components/WelcomeModal";

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

function HeroLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 280 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" aria-hidden="true">
        <defs>
          <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="hero-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="shield-gradient" x1="140" y1="20" x2="140" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lock-gradient" x1="140" y1="100" x2="140" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Outer shield glow */}
        <path
          d="M140 16L40 56v72c0 64.4 42.7 124.6 100 139.4C197.3 252.6 240 192.4 240 128V56L140 16Z"
          stroke="#00E5FF"
          strokeWidth="1"
          strokeOpacity="0.15"
          fill="none"
          filter="url(#hero-glow-strong)"
        />

        {/* Shield body */}
        <path
          d="M140 28L50 64v64c0 58.5 38.4 113 90 126.6C191.6 241 230 186.5 230 128V64L140 28Z"
          stroke="#00E5FF"
          strokeWidth="2"
          fill="url(#shield-gradient)"
        />

        {/* Inner shield line */}
        <path
          d="M140 44L62 76v52c0 52.6 33.3 101.6 78 113.8C184.7 229.6 218 180.6 218 128V76L140 44Z"
          stroke="#00E5FF"
          strokeWidth="0.5"
          strokeOpacity="0.3"
          fill="none"
        />

        {/* Lock body */}
        <rect
          x="104" y="120" width="72" height="56" rx="8"
          stroke="#00E5FF"
          strokeWidth="2"
          fill="url(#lock-gradient)"
          filter="url(#hero-glow)"
        />

        {/* Lock shackle */}
        <path
          d="M116 120V104a24 24 0 0 1 48 0v16"
          stroke="#00E5FF"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#hero-glow)"
        />

        {/* Keyhole */}
        <circle cx="140" cy="144" r="6" fill="#00E5FF" fillOpacity="0.6" />
        <path d="M140 148v10" stroke="#00E5FF" strokeWidth="3" strokeLinecap="round" />

        {/* Small decorative elements */}
        <circle cx="140" cy="144" r="10" stroke="#00E5FF" strokeWidth="0.5" strokeOpacity="0.3" fill="none" />

        {/* RIPGUARD text */}
        <text
          x="140" y="272"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="28"
          fontWeight="800"
          letterSpacing="6"
          fill="#00E5FF"
          filter="url(#hero-glow)"
        >
          RIPGUARD
        </text>

        {/* Tagline */}
        <text
          x="140" y="296"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="10"
          fontWeight="500"
          letterSpacing="4"
          fill="#00E5FF"
          fillOpacity="0.4"
        >
          THE FINAL FORTRESS
        </text>
      </svg>
    </div>
  );
}

const PRESET_ICONS: Record<string, React.ReactNode> = {
  panicLock7d: <ShieldIcon className="w-7 h-7 text-cyan" />,
  lock30d: <ClockIcon className="w-7 h-7 text-cyan" />,
  cliff7dVest90d: <LockIcon className="w-7 h-7 text-cyan" />,
};

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
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <WelcomeModal />
      <Header />

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center px-5 sm:px-8 pt-28 sm:pt-40 pb-32 sm:pb-44 overflow-hidden">
          {/* Hero background image */}
          <div className="absolute inset-0 pointer-events-none">
            <Image
              src="/hero-bg.png"
              alt=""
              fill
              priority
              className="object-cover object-center opacity-40 mix-blend-lighten"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/60 to-[#0a0a0a]" />
          </div>
          {/* Grid overlay for depth */}
          <div className="absolute inset-0 grid-overlay pointer-events-none" />
          {/* Overlay glow — dual layer for richer bloom */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[700px] h-[700px] rounded-full bg-cyan/[0.04] blur-[140px] animate-glow-pulse" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[400px] h-[400px] rounded-full bg-cyan/[0.06] blur-[80px] animate-glow-pulse" style={{ animationDelay: "2s" }} />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-8 max-w-4xl">
            <div className="animate-float">
              <HeroLogo className="w-[220px] sm:w-[280px] glow-cyan" />
            </div>

            <h1 className="text-4xl sm:text-[3.75rem] font-bold text-center leading-[1.08] tracking-tight">
              Lock your winnings before
              <br className="hidden sm:block" />
              {" "}you give them back.
            </h1>

            <p className="text-base sm:text-lg text-white/55 text-center max-w-lg leading-relaxed">
              The &ldquo;I&apos;m up, get me out&rdquo; button. Lock USDC into the{" "}
              <a
                href="https://sablier.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/30 hover:decoration-cyan/60 transition-colors"
              >
                Sablier protocol
              </a>{" "}
              with a schedule you choose. No middleman. No&nbsp;&ldquo;oops&rdquo;&nbsp;button.
            </p>

            <div className="flex flex-col sm:flex-row gap-3.5 mt-4 w-full sm:w-auto">
              <Link
                href="/create"
                className="bg-cyan text-black font-bold rounded-xl px-12 py-4.5 text-base sm:text-lg hover:bg-cyan/90 transition-all hover:shadow-[0_0_50px_rgba(0,229,255,0.3)] active:scale-[0.98] text-center"
              >
                Create a Lock
              </Link>
              <a
                href={sablierExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-white/10 text-white/60 font-semibold rounded-xl px-12 py-4.5 text-base sm:text-lg hover:border-cyan/30 hover:text-cyan transition-all text-center backdrop-blur-sm"
              >
                View Contract
              </a>
            </div>

            <p className="text-[11px] text-white/20 text-center tracking-wider uppercase mt-2">
              Self-custodial &middot; On-chain enforced &middot; Verified
              contracts &middot; Powered by Sablier v2.0
            </p>

            {!IS_TESTNET && (
              <a
                href="https://testnet.ripguard.xyz"
                className="text-xs text-white/25 hover:text-cyan/70 transition-colors mt-1"
              >
                Want to try risk-free? Use the testnet version &rarr;
              </a>
            )}
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
        <section className="px-5 sm:px-8 py-24 sm:py-28 section-divider relative overflow-hidden">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <Link
                  key={key}
                  href={`/create?preset=${key}`}
                  className="card-gradient rounded-2xl p-7 text-center group flex flex-col items-center gap-5 hover:translate-y-[-2px] transition-all duration-300 focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2"
                >
                  <div className="w-14 h-14 rounded-full border border-cyan/15 bg-cyan/[0.06] flex items-center justify-center group-hover:border-cyan/30 group-hover:bg-cyan/10 group-hover:shadow-[0_0_24px_rgba(0,229,255,0.15)] transition-all duration-300">
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
        <section className="px-5 sm:px-8 py-24 sm:py-28 section-divider">
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
                className="inline-block bg-cyan text-black font-bold rounded-xl px-10 py-4 text-lg hover:bg-cyan/90 transition-all hover:shadow-[0_0_50px_rgba(0,229,255,0.4)] active:scale-[0.98] shadow-[0_0_24px_rgba(0,229,255,0.2)]"
              >
                Create a Lock
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-5 sm:px-8 py-12 section-divider text-center space-y-5">
          <div className="flex items-center justify-center gap-2 text-white/20">
            <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M16 2L4 8v8c0 7.73 5.12 14.95 12 16.73C22.88 30.95 28 23.73 28 16V8L16 2Z" stroke="currentColor" strokeWidth="1.5" fill="rgba(0,229,255,0.04)" />
              <rect x="12" y="12" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="rgba(0,229,255,0.03)" />
              <path d="M13.5 12V10a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
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

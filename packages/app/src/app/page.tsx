"use client";

import { PRESETS, IS_TESTNET } from "@/config/contracts";
import { CHAINS, getChainConfig, isSupportedDeploymentChain, DEFAULT_CHAIN_ID } from "@/config/chains";
import { useChainId } from "wagmi";
import Link from "next/link";
import { Header } from "@/components/Header";
import { WelcomeModal } from "@/components/WelcomeModal";
import { RipGuardMark, RipGuardMark3D } from "@/components/Brand";
import { BRAND } from "@/content/brand";

function PresetIcon({ variant }: { variant: "clock" | "shield" | "lock" }) {
  const common = {
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.5,
    "aria-hidden": true as const,
  };
  if (variant === "shield") {
    return (
      <svg className="w-6 h-6" {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
        />
      </svg>
    );
  }
  if (variant === "lock") {
    return (
      <svg className="w-6 h-6" {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
        />
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6" {...common}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

const PRESET_ICONS: Record<string, "clock" | "shield" | "lock"> = {
  hourly1d: "clock",
  hourly3d: "clock",
  hourly1w: "clock",
  daily1w: "clock",
  panicLock1d: "shield",
  panicThenDaily: "lock",
};

const TRUST_POINTS = [
  {
    eyebrow: "01",
    title: "Your wallet. Always.",
    body: "Funds route directly into Sablier's audited protocol. RipGuard has no custody contract, no admin key, no withdrawal path.",
  },
  {
    eyebrow: "02",
    title: "Locks can't be broken.",
    body: "Streams are non-cancelable and non-transferable on creation. There is no early exit. There is no support ticket that undoes it.",
  },
  {
    eyebrow: "03",
    title: "Zero custom contracts.",
    body: "We deploy nothing. RipGuard is a UI in front of Sablier Lockup, the same contract securing billions in vesting streams. Verified on-chain and immutable.",
  },
  {
    eyebrow: "04",
    title: "Site goes down. You're fine.",
    body: "Your lock lives in Sablier, not on our servers. Interact directly via your chain's block explorer anytime. RipGuard disappearing tomorrow doesn't touch your funds.",
  },
];

const LIMITS = [
  "Touch your funds",
  "Withdraw early on your behalf",
  "Cancel a lock after creation",
  "Change unlock rules mid-stream",
  "Bail you out when you beg",
  "Send funds anywhere except your wallet",
];

function ChainChipRow() {
  // Show only the chains live on this deployment (mainnet vs. testnet).
  const chains = Object.values(CHAINS).filter((c) => c.isTestnet === IS_TESTNET);

  return (
    <div className="mt-12 sm:mt-14">
      <div className="eyebrow mb-5 flex items-center gap-3">
        <span className="h-px w-8 bg-cyan/40" />
        Live across
      </div>
      <ul className="flex flex-wrap gap-2">
        {chains.map((c) => (
          <li key={c.chainId}>
            <a
              href={`${c.explorerUrl}/address/${c.sablierLockup}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Verify the Sablier Lockup contract on ${c.name}`}
              className="inline-flex items-center px-3.5 py-2 text-[13px] tracking-wide rounded-full bg-surface border border-line text-muted hover:border-cyan/50 hover:text-cyan hover:bg-surface-strong transition-colors min-h-[2.5rem]"
            >
              {c.shortName}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FAQItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-line py-6">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-6 focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-4 focus-visible:rounded">
        <span className="font-display text-xl tracking-tight">{question}</span>
        <svg
          className="w-5 h-5 text-subtle group-open:rotate-45 transition-transform duration-200 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </summary>
      <div className="mt-5 text-muted leading-relaxed space-y-3 max-w-[62ch]">{children}</div>
    </details>
  );
}

export default function Home() {
  const chainId = useChainId();
  // Unconnected users + users on unsupported chains see the default chain's
  // contract link so the landing always has somewhere real to point at.
  const { sablierLockup, explorerUrl, explorerName } = getChainConfig(
    isSupportedDeploymentChain(chainId, IS_TESTNET) ? chainId : DEFAULT_CHAIN_ID,
  );
  const sablierExplorerUrl = `${explorerUrl}/address/${sablierLockup}`;
  const githubUrl = "https://github.com/fielding/ripguard";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <WelcomeModal />
      <Header />

      <main className="flex-1">
        {/* HERO — asymmetric, mark floats free, no nested cards */}
        <section className="relative overflow-hidden">
          {/* Ambient backdrop */}
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,oklch(0.30_0.060_200/0.55),transparent_60%)]" />
            <div className="absolute inset-0 grid-overlay" />
          </div>

          <div className="relative mx-auto max-w-6xl px-5 sm:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
            {/* Eyebrow */}
            <div
              className="eyebrow mb-10 flex items-center gap-3 animate-hero-enter"
              style={{ animationDelay: "0ms" }}
            >
              <span className="h-px w-10 bg-cyan/60" />
              Built on Sablier&apos;s audited contracts
            </div>

            {/* Main hero grid — wordmark & copy left, floating 3D mark right */}
            <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-12 items-center">
              <div>
                <h1
                  className="text-hero animate-hero-enter"
                  style={{ animationDelay: "140ms" }}
                >
                  Lock your
                  <br />
                  winnings before
                  <br />
                  <span className="text-cyan">you give them back.</span>
                </h1>

                <p
                  className="mt-8 max-w-[52ch] text-lg sm:text-xl leading-relaxed text-muted animate-hero-enter"
                  style={{ animationDelay: "300ms" }}
                >
                  The &ldquo;cash this out, don&apos;t let me play&rdquo; button.
                  Drop USDC into a vault that pays you back on your own schedule,
                  like a reload you designed for yourself. Non-custodial.
                  Non-cancelable. Enforced on-chain by{" "}
                  <a
                    href="https://sablier.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline decoration-cyan/40 hover:decoration-cyan underline-offset-4 transition-colors"
                  >
                    Sablier
                  </a>
                  .
                </p>

                <div
                  className="mt-10 flex flex-col sm:flex-row gap-3 animate-hero-enter"
                  style={{ animationDelay: "460ms" }}
                >
                  <Link
                    href="/create"
                    className="btn-primary btn-lg hero-cta-beacon"
                  >
                    Create a Lock
                  </Link>
                  <a
                    href={sablierExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary btn-lg"
                  >
                    View the Contract
                  </a>
                </div>

                {!IS_TESTNET && (
                  <a
                    href="https://testnet.ripguard.xyz"
                    className="mt-6 inline-flex items-center gap-2 text-sm text-faint hover:text-cyan transition-colors animate-hero-enter"
                    style={{ animationDelay: "620ms" }}
                  >
                    Test the flow on Base Sepolia
                    <span aria-hidden>→</span>
                  </a>
                )}
              </div>

              {/* 3D mark — floats free, no card frame. Outer wrapper handles
                  the one-shot mount animation (scale + fade); inner wrapper
                  keeps the continuous float. They don't conflict because
                  they use different transform targets. */}
              <div className="relative flex items-center justify-center lg:justify-end">
                <div
                  className="animate-hero-mark-enter"
                  style={{ animationDelay: "140ms" }}
                >
                  <div className="animate-float">
                    <RipGuardMark3D
                      pulse
                      className="h-64 w-64 sm:h-80 sm:w-80 lg:h-[26rem] lg:w-[26rem]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Proof line — not metric cards, just a row of claims */}
            <div className="mt-20 sm:mt-24 border-t border-line pt-8">
              <ul className="flex flex-wrap items-baseline gap-x-10 gap-y-4 text-sm">
                <li className="flex items-baseline gap-2">
                  <span className="font-display text-cyan text-2xl tabular">100%</span>
                  <span className="text-muted">Non-custodial</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="font-display text-cyan text-2xl tabular">4×</span>
                  <span className="text-muted">Independently audited</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="font-display text-cyan text-2xl tabular">0</span>
                  <span className="text-muted">Admin keys</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="font-display text-cyan text-2xl tabular">0</span>
                  <span className="text-muted">Lines of new code</span>
                </li>
              </ul>
            </div>

            {/* Chain chip row — quietly tells users we're on every casino-relevant
                chain. Each chip links to that chain's Sablier Lockup contract on
                its native explorer so verification is one click away. */}
            <ChainChipRow />
          </div>
        </section>

        {/* PROBLEM — single column, editorial pullquote style */}
        <section className="px-5 sm:px-8 py-28 sm:py-40">
          <div className="mx-auto max-w-6xl">
            <div className="eyebrow mb-8">The problem</div>
            <h2 className="text-display max-w-4xl">
              You don&apos;t need better luck.
              <br />
              <span className="text-cyan">You need to be saved from yourself.</span>
            </h2>
            <div className="mt-12 space-y-6 text-lg text-muted leading-relaxed max-w-[58ch]">
              <p>
                Bet. Win. &ldquo;One more hit.&rdquo; Give it all back. You know
                the drill. Willpower doesn&apos;t break it.{" "}
                <span className="text-foreground">Constraints do.</span>
              </p>
              <p>
                RipGuard is the constraint. Not a pitch. Not a product. Just
                code that protects the winner from the degen you&apos;re about
                to be. The same loop the casino runs on you, aimed the other
                way.
              </p>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS — numbered editorial, no identical cards */}
        <section id="how-it-works" className="px-5 sm:px-8 py-28 sm:py-40 border-t border-line">
          <div className="mx-auto max-w-6xl">
            <div className="eyebrow mb-8">How it works</div>
            <h2 className="text-display max-w-3xl">
              Win it. Lock it. <span className="text-cyan">Get reloads.</span>
            </h2>
            <p className="mt-6 text-lg text-muted max-w-[52ch] leading-relaxed">
              Your past self making rules your future self can&apos;t break.
            </p>

            <ol className="mt-20 space-y-16 sm:space-y-20">
              <li className="grid sm:grid-cols-[auto_1fr] gap-6 sm:gap-12 items-center">
                <div className="font-display text-cyan text-6xl sm:text-8xl tabular leading-none">
                  01
                </div>
                <div className="max-w-2xl">
                  <h3 className="text-h2 text-foreground">Cash out</h3>
                  <p className="mt-4 text-muted leading-relaxed">
                    You hit. Cash out. Get it off the site before &ldquo;one
                    more hit&rdquo; kicks in. Winning was the hard part. Keeping
                    it starts now.
                  </p>
                </div>
              </li>
              <li className="grid sm:grid-cols-[auto_1fr] gap-6 sm:gap-12 items-center">
                <div className="font-display text-cyan text-6xl sm:text-8xl tabular leading-none">
                  02
                </div>
                <div className="max-w-2xl">
                  <h3 className="text-h2 text-foreground">Design your reload</h3>
                  <p className="mt-4 text-muted leading-relaxed">
                    Hourly drip, daily drop, weekly payout, or one-time unlock.
                    Set the terms{" "}
                    <span className="text-foreground italic">
                      the degen in the middle will hate you for
                    </span>
                    .
                  </p>
                </div>
              </li>
              <li className="grid sm:grid-cols-[auto_1fr] gap-6 sm:gap-12 items-center">
                <div className="font-display text-cyan text-6xl sm:text-8xl tabular leading-none">
                  03
                </div>
                <div className="max-w-2xl">
                  <h3 className="text-h2 text-foreground">Lock it in</h3>
                  <p className="mt-4 text-muted leading-relaxed">
                    One signature. Your USDC routes directly into Sablier.
                    Non-cancelable. Non-transferable. No support ticket. No going
                    back.
                  </p>
                </div>
              </li>
              <li className="grid sm:grid-cols-[auto_1fr] gap-6 sm:gap-12 items-center">
                <div className="font-display text-cyan text-6xl sm:text-8xl tabular leading-none">
                  04
                </div>
                <div className="max-w-2xl">
                  <h3 className="text-h2 text-foreground">Get your reloads</h3>
                  <p className="mt-4 text-muted leading-relaxed">
                    Time passes. You come back and claim what the schedule
                    unlocks. Your past self paying your future self back.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* PRESETS — card grid is earned here because these are actually selections */}
        <section className="px-5 sm:px-8 py-28 sm:py-40 border-t border-line">
          <div className="mx-auto max-w-6xl">
            <div className="eyebrow mb-8">Reloads</div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8 mb-16">
              <div className="max-w-2xl space-y-5">
                <h2 className="text-display">Spaced hits. Same high. No chase.</h2>
                <p className="text-lg text-muted leading-relaxed max-w-[52ch]">
                  Intermittent rewards on a timer. The slot machine&apos;s trick,
                  running in your favor.
                </p>
              </div>
              <Link
                href="/create"
                className="inline-flex items-center min-h-[2.75rem] px-2 -mx-2 text-sm text-muted hover:text-cyan transition-colors shrink-0"
              >
                Or build a custom one →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <Link
                  key={key}
                  href={`/create?preset=${key}`}
                  className="group relative bg-background p-8 flex flex-col gap-6 hover:bg-surface preset-card-hover focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-[-2px]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-lg border border-line flex items-center justify-center text-cyan group-hover:border-cyan/40 transition-colors duration-300">
                      <PresetIcon variant={PRESET_ICONS[key]} />
                    </div>
                    <span className="eyebrow group-hover:text-cyan transition-colors duration-300">
                      Select
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-2xl tracking-tight group-hover:text-cyan transition-colors duration-300">
                      {preset.label}
                    </h3>
                    <p className="mt-2 text-sm text-muted leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* TRUST — four claims as an editorial spec sheet */}
        <section id="trust" className="px-5 sm:px-8 py-28 sm:py-40 border-t border-line">
          <div className="mx-auto max-w-6xl">
            <div className="eyebrow mb-8">Trust model</div>
            <h2 className="text-display max-w-3xl">
              Zero custom contracts.
              <br />
              <span className="text-cyan">Zero custody.</span>
            </h2>
            <p className="mt-6 text-lg text-muted max-w-[58ch] leading-relaxed">
              RipGuard is a UI. The lock is a Sablier stream, written directly to
              their audited on-chain protocol. Your USDC never touches RipGuard
              infrastructure.
            </p>

            <div className="mt-20 grid gap-12 sm:grid-cols-2 sm:gap-x-16 sm:gap-y-14">
              {TRUST_POINTS.map((point) => (
                <div key={point.eyebrow}>
                  <div className="eyebrow text-cyan/70 mb-3 tabular">{point.eyebrow}</div>
                  <h3 className="font-display text-2xl tracking-tight">{point.title}</h3>
                  <p className="mt-3 text-muted leading-relaxed max-w-[46ch]">{point.body}</p>
                </div>
              ))}
            </div>

            {/* Verify in 60 seconds — editorial spec block. Intentionally
                NO border-t: the eyebrow + text-2xl headline already signal
                "subsection inside Trust", and a border creates a mixed
                full-section signal without the matching padding. Clean
                spatial break via mt-24 sm:mt-32 instead. */}
            <div className="mt-24 sm:mt-32">
              <div className="grid gap-8 sm:grid-cols-[1fr_2fr] sm:gap-16">
                <div>
                  <div className="eyebrow mb-3">Verify</div>
                  <h3 className="font-display text-2xl tracking-tight">
                    Don&apos;t trust us.
                    <br />
                    <span className="text-cyan">Check for yourself.</span>
                  </h3>
                </div>
                <ol className="space-y-5 text-muted leading-relaxed">
                  <li className="flex gap-4">
                    <span className="text-cyan tabular font-semibold shrink-0 w-6">01</span>
                    <span>
                      Open the{" "}
                      <a
                        href={sablierExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan transition-colors"
                      >
                        Sablier Lockup contract
                      </a>{" "}
                      on the chain&apos;s block explorer. Verified, immutable, no proxy.
                    </span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-cyan tabular font-semibold shrink-0 w-6">02</span>
                    <span>
                      Confirm there is no admin withdrawal and no upgrade path. RipGuard
                      has no custom contract.
                    </span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-cyan tabular font-semibold shrink-0 w-6">03</span>
                    <span>
                      Lock $5 first. Seriously. Watch it work before you commit real
                      size.
                    </span>
                  </li>
                </ol>
              </div>
              <p className="mt-12 text-sm text-faint">
                The repo is on{" "}
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted underline decoration-line hover:text-cyan hover:decoration-cyan transition-colors"
                >
                  GitHub
                </a>{" "}
                if you&apos;re the type to read code.
              </p>
            </div>
          </div>
        </section>

        {/* LIMITS — bold statement of what RipGuard explicitly cannot do */}
        <section className="px-5 sm:px-8 py-28 sm:py-40 border-t border-line">
          <div className="mx-auto max-w-6xl">
            <div className="eyebrow mb-8">Limitations</div>
            <h2 className="text-display max-w-3xl">
              Things we can&apos;t do,
              <br />
              <span className="text-cyan">even if you beg.</span>
            </h2>
            <p className="mt-6 text-lg text-muted max-w-[52ch] leading-relaxed">
              These aren&apos;t policies we could change tomorrow. They&apos;re
              enforced by the contract. We couldn&apos;t override them if we wanted
              to.
            </p>

            <ul className="mt-16 grid gap-x-12 gap-y-4 sm:grid-cols-2 max-w-4xl">
              {LIMITS.map((limit) => (
                <li
                  key={limit}
                  className="flex items-center gap-4 py-4 border-b border-line tabular"
                >
                  <svg
                    className="w-5 h-5 text-cyan shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  <span className="text-foreground">{limit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FOUNDER — editorial, widened */}
        <section className="px-5 sm:px-8 py-28 sm:py-40 border-t border-line">
          <div className="mx-auto max-w-6xl">
            <div className="eyebrow mb-8">Why this exists</div>
            <h2 className="text-display">
              Built by someone
              <br />
              <span className="text-cyan">who needed it.</span>
            </h2>
            <p className="mt-5 text-lg text-muted italic">…many times.</p>
            <div className="mt-12 space-y-6 text-lg text-muted leading-relaxed max-w-[58ch]">
              <p>
                You know the feeling. You hit a big win. Your brain goes
                &ldquo;I&apos;m unstoppable.&rdquo; One more play. Then another.
                Then the whole bag is gone.
              </p>
              <p>
                The problem isn&apos;t intelligence. It&apos;s{" "}
                <span className="text-foreground">tilt</span>. And willpower
                doesn&apos;t fix tilt. Only constraints do.
              </p>
              <p>
                But cold-turkey locks are their own kind of torture. So RipGuard
                borrows the slot machine&apos;s trick. Intermittent rewards on a
                schedule. Except instead of you feeding the machine, the machine
                feeds you.
              </p>
              <p>
                The tool I wish existed in those moments. A way to lock winnings
                on-chain so your future self can&apos;t give them back.
              </p>
              <p className="text-sm text-faint pt-4">
                Don&apos;t trust the site?{" "}
                <a
                  href={sablierExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted underline decoration-line hover:text-cyan hover:decoration-cyan transition-colors"
                >
                  Verify the contract yourself
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        {/* FEES — tight, quoted */}
        <section className="px-5 sm:px-8 py-28 sm:py-40 border-t border-line">
          <div className="mx-auto max-w-6xl">
            <div className="eyebrow mb-8">Fees</div>
            <h2 className="text-display max-w-4xl">
              <span className="tabular">0.5%</span> to lock.
              <br />
              <span className="text-cyan">Nothing else. Ever.</span>
            </h2>
            <div className="mt-12 space-y-5 text-lg text-muted leading-relaxed max-w-[58ch]">
              <p>
                Collected by Sablier&apos;s native broker mechanism during stream
                creation. It&apos;s split from your deposit and sent directly to
                the RipGuard treasury. Shown before you sign.
              </p>
              <p className="text-sm text-faint">
                No hidden withdraw fees. No subscriptions. No yield cuts. Every
                fee is visible on-chain in the broker field of your own lock
                transaction.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-5 sm:px-8 py-28 sm:py-40 border-t border-line">
          <div className="mx-auto max-w-6xl">
            <div className="eyebrow mb-8">FAQ</div>
            <h2 className="text-display mb-16">Questions people ask.</h2>

            <div className="max-w-3xl border-t border-line">
              <FAQItem question="Can RipGuard rug me?">
                <p>
                  No. There&apos;s no RipGuard contract holding your money. Your
                  USDC goes straight into Sablier. An immutable, audited protocol
                  with no admin keys, no upgrade path, and no &ldquo;pause&rdquo;
                  button we could hit.
                </p>
                <p>
                  We deploy zero custom code. RipGuard is a UI in front of
                  Sablier. If we wanted to rug you, we&apos;d have to rug Sablier
                  first. Sablier can&apos;t rug itself.
                </p>
                <p className="text-faint">
                  All smart contracts carry risk. Start with $5. Verify the
                  Sablier contract yourself on the chain&apos;s block explorer.
                </p>
              </FAQItem>

              <FAQItem question="Can I unlock early if I really need it?">
                <p>No. That&apos;s the point.</p>
                <p>
                  The degen in the middle is going to beg you to undo it.
                  They&apos;re going to have a very good reason. They&apos;re
                  always going to have a very good reason. None of them work.
                </p>
                <p>If you need flexibility, don&apos;t lock.</p>
              </FAQItem>

              <FAQItem question="What if RipGuard goes offline?">
                <p>
                  Your lock lives in Sablier, not on our servers. If this site
                  goes down tomorrow, your vault keeps counting down and you can
                  claim directly through the chain&apos;s block explorer or the Sablier app.
                </p>
                <p className="text-foreground">
                  RipGuard is the UI. Sablier is the bank.
                </p>
              </FAQItem>

              <FAQItem question="Is this an investment product?">
                <p>
                  No. No yield. No returns. No staking. No &ldquo;strategy.&rdquo;
                  You put USDC in, time passes, you come back and claim USDC out.
                  The same amount, on the schedule you set.
                </p>
                <p className="text-faint">
                  If you wanted growth, you wouldn&apos;t be here.
                </p>
              </FAQItem>

              <FAQItem question="Why pay the fee instead of doing this myself?">
                <p>You could. Sablier is open. Go for it.</p>
                <p>Or you could pay 0.5% to get:</p>
                <ul className="list-disc list-outside pl-5 space-y-1">
                  <li>Reload presets designed around real betting sessions</li>
                  <li>Proof-of-lock receipts you can screenshot and post</li>
                  <li>A dashboard that tracks every vault in one place</li>
                  <li>A brain that designed this while not on tilt</li>
                </ul>
                <p>
                  The 0.5% keeps the site alive and the presets tuned. No custom
                  contracts. Nothing fancy.
                </p>
              </FAQItem>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA — quiet command */}
        <section className="relative px-5 sm:px-8 py-32 sm:py-44 border-t border-line overflow-hidden">
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-cyan/[0.05] blur-[160px]" />
            <div className="absolute inset-0 grid-overlay" />
          </div>
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="eyebrow mb-8">
              <span className="inline-flex items-center gap-3">
                <span className="h-px w-8 bg-cyan/60" />
                Start with $5
                <span className="h-px w-8 bg-cyan/60" />
              </span>
            </p>
            <h2 className="text-hero">
              Stop giving back
              <br />
              <span className="text-cyan">your gains.</span>
            </h2>
            <p className="mt-8 text-lg sm:text-xl text-muted max-w-xl mx-auto">
              You already know you need this. Lock now, thank yourself later.
            </p>
            <div className="mt-12">
              <Link
                href="/create"
                className="btn-primary btn-lg hero-cta-beacon"
              >
                Create a Lock
              </Link>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="px-5 sm:px-8 py-16 border-t border-line">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <RipGuardMark className="h-6 w-6" />
              <span className="font-display text-lg tracking-tight">RipGuard</span>
            </div>
            <nav className="flex items-center gap-2 sm:gap-4 text-sm text-muted">
              <Link
                href="/vaults"
                className="inline-flex items-center min-h-[2.75rem] px-3 hover:text-cyan transition-colors"
              >
                My Vaults
              </Link>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center min-h-[2.75rem] px-3 hover:text-cyan transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://x.com/ripguardxyz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center min-h-[2.75rem] px-3 hover:text-cyan transition-colors"
              >
                X
              </a>
              <a
                href={sablierExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center min-h-[2.75rem] px-3 hover:text-cyan transition-colors"
              >
                {explorerName}
              </a>
            </nav>
          </div>
          <p className="mt-10 text-xs text-faint max-w-2xl mx-auto text-center leading-relaxed">
            RipGuard does not custody funds. All locks are created directly in
            Sablier&apos;s audited protocol. Non-custodial. Immutable. Not
            financial advice. DYOR. 0.5% broker fee collected via Sablier&apos;s
            native mechanism.
          </p>
        </footer>
      </main>
    </div>
  );
}

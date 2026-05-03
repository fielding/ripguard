"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

// WalletMultiButton has its own client-only render path. Loading dynamically
// with ssr:false keeps it from blowing up Next's static prerender pass.
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (m) => m.WalletMultiButton,
    ),
  { ssr: false },
);

type NavLink = { href: string; label: string; hash?: boolean };

const APP_NAV_LINKS: NavLink[] = [
  { href: "/create", label: "Create" },
  { href: "/vaults", label: "Vaults" },
];

const HOME_NAV_LINKS: NavLink[] = [
  { href: "#how-it-works", label: "How it works", hash: true },
  { href: "#trust", label: "Trust", hash: true },
  { href: "/vaults", label: "Vaults" },
];

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const navLinks = isHome ? HOME_NAV_LINKS : APP_NAV_LINKS;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
        {/* TODO(logo): when the proper RipGuard lock mark exists, render it
            here at 32px, left of the wordmark, with --violet as the
            rim-light color on this surface. Wordmark stands alone until
            then — see design handoff §2c. */}
        <Link
          href="/"
          className="flex items-baseline gap-0 shrink-0 focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-4 focus-visible:rounded"
          aria-label="RipGuard home"
        >
          {/* Header wordmark renders ALL CAPS at 20px (text-xl). That
              size sits in the "mid caps" tracking band — 0 to 0.02em.
              tracking-[0.01em] keeps the bunker tightness without
              crashing R/I or P/G. The .brand-wordmark utility is
              reserved for the larger display contexts (hero, etc.). */}
          <span className="font-display text-lg sm:text-xl uppercase tracking-[0.01em] leading-none">
            RIP<span className="text-cyan ml-[0.02em]">GUARD</span>
          </span>
          {/* Chain chip is brand polish, not load-bearing. Hide below sm so
              the wordmark + WalletMultiButton can both fit on a 375px
              viewport without truncation. */}
          <span className="brand-chain-chip hidden sm:inline-flex">· SOL</span>
        </Link>

        <nav className="hidden md:flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          {navLinks.map((link) => {
            const isActive = !link.hash && pathname === link.href;
            const className = `nav-link inline-flex items-center min-h-[2.75rem] px-4 transition-colors ${
              isActive
                ? "text-cyan"
                : "text-muted hover:text-foreground"
            }`;
            return link.hash ? (
              <a key={link.href} href={link.href} className={className}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={className}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
          {/* Tablet mini-nav (sm to md): /create + /vaults links. Hidden
              below sm — at 375px the wordmark + WalletMultiButton
              already saturate the gutter, so the mini-nav has nowhere to
              live. Mobile users navigate via the wordmark → home links
              and the footer instead. */}
          <nav className="hidden sm:flex md:hidden items-center">
            {navLinks.slice(0, 2).map((link) => {
              const isActive = !link.hash && pathname === link.href;
              const className = `nav-link inline-flex items-center min-h-[2.75rem] px-2 transition-colors ${
                isActive ? "text-cyan" : "text-muted hover:text-foreground"
              }`;
              return link.hash ? (
                <a key={link.href} href={link.href} className={className}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className={className}>
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {isHome ? (
            <Link
              href="/create"
              className="btn-primary !min-h-[2.5rem] !py-2 !px-4 !text-[0.8125rem] !font-semibold sm:!min-h-[2.75rem] sm:!py-2.5 sm:!px-5"
            >
              Create a Lock
            </Link>
          ) : (
            <WalletMultiButton />
          )}
        </div>
      </div>
    </header>
  );
}

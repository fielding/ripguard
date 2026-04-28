"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        {/* TODO(logo): when the proper RipGuard lock mark exists, render
            it here at 32px, left of the wordmark. Wordmark stands alone
            until then — keeps the perceived quality high relative to a
            placeholder SVG. */}
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
          <span className="font-display text-xl uppercase tracking-[0.01em] leading-none">
            RIP<span className="text-cyan ml-[0.02em]">GUARD</span>
          </span>
        </Link>

        {/* Desktop nav */}
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

        {/* Right side: mobile nav + CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <nav className="flex md:hidden items-center gap-0">
            {navLinks.slice(0, 2).map((link) => {
              const isActive = !link.hash && pathname === link.href;
              const className = `nav-link inline-flex items-center min-h-[2.75rem] px-3 transition-colors ${
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
              className="btn-primary !min-h-[2.75rem] !py-2.5 !px-5 !text-[0.8125rem] !font-semibold"
            >
              Create a Lock
            </Link>
          ) : (
            <ConnectButton chainStatus="icon" showBalance={false} />
          )}
        </div>
      </div>
    </header>
  );
}

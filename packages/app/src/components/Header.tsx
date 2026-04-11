"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RipGuardMark } from "@/components/Brand";

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
        {/* Brand lockup */}
        <Link
          href="/"
          className="flex items-center gap-3 shrink-0 focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-4 focus-visible:rounded"
          aria-label="RipGuard home"
        >
          <RipGuardMark className="h-9 w-9 shrink-0" />
          <span className="font-display text-xl tracking-tight leading-none">
            Rip<span className="text-cyan">Guard</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          {navLinks.map((link) => {
            const isActive = !link.hash && pathname === link.href;
            const className = `px-4 py-2 text-sm font-medium transition-colors ${
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
              const className = `px-2.5 py-1.5 text-xs font-medium transition-colors ${
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
              className="btn-primary !min-h-0 !py-2.5 !px-5 !text-[0.8125rem] !font-semibold"
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

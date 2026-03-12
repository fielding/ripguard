"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RipGuardMark } from "@/components/Brand";

const APP_NAV_LINKS = [
  { href: "/create", label: "Create Lock" },
  { href: "/vaults", label: "My Vaults" },
];

const HOME_NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#trust", label: "Why trust it" },
  { href: "/vaults", label: "Vaults" },
];

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const navLinks = isHome ? HOME_NAV_LINKS : APP_NAV_LINKS;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060a0d]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <RipGuardMark className="h-9 w-9 shrink-0" />
            <div className="leading-none">
              <span className="block text-sm font-semibold uppercase tracking-[0.22em] text-white/88">
                Rip<span className="text-cyan">Guard</span>
              </span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.3em] text-white/28">
                Non-cancelable vaults
              </span>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-cyan/[0.09] text-cyan"
                      : "text-white/45 hover:text-white/78"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <nav className="flex sm:hidden items-center gap-1">
            {navLinks.slice(0, 2).map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "bg-cyan/[0.09] text-cyan"
                      : "text-white/35 hover:text-white/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {isHome ? (
            <Link href="/create" className="button-primary px-5 py-2.5 text-sm min-h-0">
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

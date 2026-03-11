"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";

function RipGuardLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2L4 8v8c0 7.73 5.12 14.95 12 16.73C22.88 30.95 28 23.73 28 16V8L16 2Z" stroke="#00E5FF" strokeWidth="1.8" fill="rgba(0,229,255,0.08)" />
      <rect x="12" y="12" width="8" height="7" rx="1.5" stroke="#00E5FF" strokeWidth="1.5" fill="rgba(0,229,255,0.06)" />
      <path d="M13.5 12V10a2.5 2.5 0 0 1 5 0v2" stroke="#00E5FF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/create", label: "Create Lock" },
  { href: "/vaults", label: "My Vaults" },
  { href: "/recovery", label: "Recovery Lab" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-white/[0.06] sticky top-0 z-50 backdrop-blur-xl bg-black/60">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5">
          <RipGuardLogo className="w-7 h-7 glow-cyan" />
          <span className="text-lg font-bold tracking-tight">RipGuard</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "text-cyan bg-cyan/[0.08]"
                    : "text-white/40 hover:text-white/70"
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
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  isActive
                    ? "text-cyan bg-cyan/[0.08]"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </div>
    </header>
  );
}

"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";

function RipGuardLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shield-fill-hdr" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {/* Shield body */}
      <path
        d="M16 2.5L3.5 7.5v8.8c0 7.2 5.2 13.9 12.5 15.7C23.3 30.2 28.5 23.5 28.5 16.3V7.5L16 2.5Z"
        stroke="#00E5FF"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="url(#shield-fill-hdr)"
      />
      {/* Lock body */}
      <rect x="11.5" y="13" width="9" height="7.5" rx="1.8" stroke="#00E5FF" strokeWidth="1.4" fill="rgba(0,229,255,0.10)" />
      {/* Lock shackle */}
      <path d="M13.5 13v-2.2a2.5 2.5 0 0 1 5 0V13" stroke="#00E5FF" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Keyhole */}
      <circle cx="16" cy="16.5" r="1.2" fill="#00E5FF" fillOpacity="0.8" />
      <path d="M16 17.5v1.8" stroke="#00E5FF" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/create", label: "Create Lock" },
  { href: "/vaults", label: "My Vaults" },
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

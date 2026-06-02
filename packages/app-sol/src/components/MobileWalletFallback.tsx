"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

// Mobile users without a Solana wallet extension hit a dead-end at the
// standard wallet modal — there's nothing to click. The Solana Mobile
// Wallet Adapter (registered in providers.tsx) covers Android and some
// iOS wallets, but iOS coverage is patchy. This component renders an
// always-visible escape hatch: tap-through deep links that re-open the
// dApp inside Phantom or Solflare's in-app browser, where window.solana
// behaves like a desktop extension.

interface SolanaWindow {
  phantom?: { solana?: unknown };
  solflare?: unknown;
  solana?: unknown;
}

function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function hasInjectedSolanaWallet(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as SolanaWindow;
  return Boolean(w.phantom?.solana || w.solflare || w.solana);
}

/**
 * Show on mobile + no-injected-wallet + not-connected. Two deep-link CTAs
 * that send the user into Phantom / Solflare's in-app browser at the
 * current URL, preserving the path so they land back on /create or
 * /vaults already inside the wallet's browser.
 */
export function MobileWalletFallback() {
  const { connected } = useWallet();
  const [show, setShow] = useState(false);
  const [urls, setUrls] = useState<{ phantom: string; solflare: string } | null>(null);

  // Derives from client-only signals (navigator UA, injected-wallet globals,
  // window.location) plus the reactive `connected` flag. Reading those during
  // render would mismatch SSR, so we compute on mount/after connect — the
  // setState here is the intended post-hydration sync, not a cascading render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (connected) {
      setShow(false);
      return;
    }
    if (!isMobileUserAgent() || hasInjectedSolanaWallet()) {
      setShow(false);
      return;
    }
    const here = encodeURIComponent(window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    setUrls({
      phantom: `https://phantom.app/ul/browse/${here}?ref=${ref}`,
      solflare: `https://solflare.com/ul/v1/browse/${here}/${ref}`,
    });
    setShow(true);
  }, [connected]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!show || !urls) return null;

  return (
    <div className="mt-6 rounded-md border border-line p-5">
      <div className="eyebrow mb-3 text-faint">On mobile?</div>
      <p className="text-sm text-muted leading-relaxed">
        Open this page inside your wallet&apos;s in-app browser to connect.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={urls.phantom}
          className="btn-primary !min-h-[2.5rem] !py-2 !px-4 !text-sm"
        >
          Open in Phantom
        </a>
        <a
          href={urls.solflare}
          className="btn-secondary !min-h-[2.5rem] !py-2 !px-4 !text-sm"
        >
          Open in Solflare
        </a>
      </div>
    </div>
  );
}

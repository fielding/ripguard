"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// WalletConnect's ethereum-provider accesses `indexedDB` at module init time,
// which crashes static prerender of /_not-found and /_global-error.
// ssr: false must live inside a "use client" component.
const Providers = dynamic(() => import("@/providers").then((m) => ({ default: m.Providers })), {
  ssr: false,
});

export function ClientProviders({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}

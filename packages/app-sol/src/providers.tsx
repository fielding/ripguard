"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
} from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";
import { trackWalletConnect, trackAppError } from "@/lib/analytics";
import { RPC_URL } from "@/config/solsab";

import "@solana/wallet-adapter-react-ui/styles.css";

function WalletTracker() {
  const { connected } = useWallet();
  const prevConnected = useRef(false);

  useEffect(() => {
    if (connected && !prevConnected.current) {
      trackWalletConnect();
    }
    prevConnected.current = connected;
  }, [connected]);

  return null;
}

function GlobalErrorHandler() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      trackAppError({
        message: event.message || "Unhandled error",
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const message =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason);
      trackAppError({ message: `Unhandled rejection: ${message}` });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Explicit adapters for Phantom + Solflare; Backpack and other modern
  // Solana wallets auto-register via the @wallet-standard interface, so they
  // show up in the modal without needing a dedicated adapter dependency.
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <WalletTracker />
            <GlobalErrorHandler />
            <ToastProvider>{children}</ToastProvider>
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

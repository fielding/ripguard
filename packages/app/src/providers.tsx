"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config } from "@/config/wagmi";
import { ToastProvider } from "@/components/Toast";
import { TestnetBanner } from "@/components/TestnetBanner";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { trackWalletConnect, trackAppError } from "@/lib/analytics";

import "@rainbow-me/rainbowkit/styles.css";

function WalletTracker() {
  const { isConnected } = useAccount();
  const prevConnected = useRef(false);

  useEffect(() => {
    if (isConnected && !prevConnected.current) {
      trackWalletConnect();
    }
    prevConnected.current = isConnected;
  }, [isConnected]);

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

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: "#00E5FF",
          accentColorForeground: "#000000",
          borderRadius: "medium",
          overlayBlur: "small",
        })}>
          <WalletTracker />
          <GlobalErrorHandler />
          <TestnetBanner />
          <ToastProvider>{children}</ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Placeholder for the Solana vaults dashboard.
// Real flow ships in tix RG-4d3d55:
//   - connect via wallet adapter
//   - getProgramAccounts on SolSab Lockup, scoped by NFT collection ownership
//   - render countdown / claimable amount per stream
//   - claim via withdraw or withdraw_max instruction

function VaultsPagePlaceholder() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="mx-auto max-w-3xl px-5 sm:px-8 py-16">
        <h1 className="font-display text-4xl tracking-tight">
          Your Vaults<span className="text-cyan">.</span>
        </h1>
        <p className="mt-4 text-muted text-lg leading-relaxed">
          Vault discovery on Solana ships in the next ticket. Once it's live,
          your locked USDC streams will show here automatically — countdowns,
          claimable amounts, and a one-click claim.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/" className="btn-secondary">
            Back to landing
          </Link>
          <Link href="/create" className="btn-secondary">
            Create a lock
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function VaultsPage() {
  return (
    <ErrorBoundary>
      <VaultsPagePlaceholder />
    </ErrorBoundary>
  );
}

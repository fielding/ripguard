"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Placeholder for the Solana lock-creation flow.
// Real flow ships in tix RG-4d3d55:
//   - connect via wallet adapter
//   - create USDC ATA if missing
//   - splTransfer 0.5% to treasury (TS-skim)
//   - create_with_durations_ll on SolSab Lockup
//   - share-card emit + redirect to /vaults

function CreatePagePlaceholder() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="mx-auto max-w-3xl px-5 sm:px-8 py-16">
        <h1 className="font-display text-4xl tracking-tight">
          Create a Lock<span className="text-cyan">.</span>
        </h1>
        <p className="mt-4 text-muted text-lg leading-relaxed">
          The Solana lock flow is wired up in the next ticket. Connect your
          wallet from the header — once the flow lands, you'll pick a preset,
          sign once, and your USDC drops into a non-cancelable Sablier stream
          on Solana.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/" className="btn-secondary">
            Back to landing
          </Link>
          <Link href="/vaults" className="btn-secondary">
            See vaults
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function CreatePage() {
  return (
    <ErrorBoundary>
      <CreatePagePlaceholder />
    </ErrorBoundary>
  );
}

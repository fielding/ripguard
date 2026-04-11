import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Vaults · RipGuard",
  description:
    "View and claim from your time-locked USDC vaults on Base. Track vesting progress, see claimable amounts, and withdraw when unlocked. Powered by Sablier v2.0.",
  openGraph: {
    title: "Your Vaults · RipGuard",
    description:
      "View and claim from your time-locked USDC vaults on Base. Track vesting progress and withdraw when unlocked.",
  },
};

export default function VaultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

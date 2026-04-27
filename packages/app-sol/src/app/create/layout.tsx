import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Lock · RipGuard",
  description:
    "Lock your USDC into a time-locked vault on Solana. Pick a schedule, sign once, and your funds are locked in Sablier. Non-cancelable.",
  openGraph: {
    title: "Create Lock · RipGuard",
    description:
      "Lock your USDC into a time-locked vault on Solana. Pick a schedule, sign once, and your funds are locked in Sablier. Non-cancelable.",
  },
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

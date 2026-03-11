import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Lock — RipGuard",
  description:
    "Lock your USDC into a time-locked vault on Base. Pick a schedule, confirm, and your funds are locked in Sablier. Non-cancelable. Powered by Sablier v2.0.",
  openGraph: {
    title: "Create Lock — RipGuard",
    description:
      "Lock your USDC into a time-locked vault on Base. Pick a schedule, confirm, and your funds are locked in Sablier. Non-cancelable.",
  },
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

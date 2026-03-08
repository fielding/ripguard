import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, baseSepolia } from "wagmi/chains";

const isTestnet = process.env.NEXT_PUBLIC_CHAIN === "base-sepolia";

export const config = getDefaultConfig({
  appName: "RipGuard",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "YOUR_WC_PROJECT_ID",
  chains: [isTestnet ? baseSepolia : base],
  ssr: true,
});

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, baseSepolia } from "wagmi/chains";

const isTestnet = process.env.NEXT_PUBLIC_CHAIN === "base-sepolia";

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
if (!wcProjectId && process.env.NODE_ENV === "development") {
  console.warn(
    "[RipGuard] NEXT_PUBLIC_WC_PROJECT_ID is not set — wallet connections may fail."
  );
}

export const config = getDefaultConfig({
  appName: "RipGuard",
  projectId: wcProjectId || "YOUR_WC_PROJECT_ID",
  chains: [isTestnet ? baseSepolia : base],
  ssr: true,
});

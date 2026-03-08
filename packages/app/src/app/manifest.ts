import type { MetadataRoute } from "next";
import { IS_TESTNET } from "@/config/contracts";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: IS_TESTNET ? "RipGuard Testnet" : "RipGuard",
    short_name: IS_TESTNET ? "RG Testnet" : "RipGuard",
    description:
      "Lock your crypto winnings into time-locked vaults on Base. Non-cancelable. Self-custodial. Powered by Sablier.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#000000",
    icons: [
      {
        src: "/logo-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

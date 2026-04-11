import type { MetadataRoute } from "next";
import { IS_TESTNET } from "@/config/contracts";
import { BRAND } from "@/content/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: IS_TESTNET ? BRAND.testnetName : BRAND.name,
    short_name: IS_TESTNET ? BRAND.testnetShortName : BRAND.shortName,
    description: BRAND.manifestDescription,
    start_url: "/",
    display: "standalone",
    // sRGB equivalents of --background oklch(0.14 0.008 200), tinted toward brand cyan
    background_color: "#0a1014",
    theme_color: "#0a1014",
    icons: [
      {
        src: "/logo-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

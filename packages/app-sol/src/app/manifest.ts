import type { MetadataRoute } from "next";
import { IS_TESTNET } from "@/config/solsab";
import { BRAND } from "@/content/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: IS_TESTNET ? BRAND.testnetName : BRAND.name,
    short_name: IS_TESTNET ? BRAND.testnetShortName : BRAND.shortName,
    description: BRAND.manifestDescription,
    start_url: "/",
    display: "standalone",
    // sRGB equivalent of --background oklch(0.14 0.008 290), tinted toward steel violet
    background_color: "#0d0c14",
    theme_color: "#0d0c14",
    icons: [
      {
        src: "/logo-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

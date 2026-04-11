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

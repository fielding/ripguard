import type { MetadataRoute } from "next";
import { IS_TESTNET } from "@/config/solsab";

const siteUrl = IS_TESTNET
  ? "https://testnet.sol.ripguard.xyz"
  : "https://sol.ripguard.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";
import { IS_TESTNET } from "@/config/contracts";

const siteUrl = IS_TESTNET
  ? "https://testnet.ripguard.xyz"
  : "https://ripguard.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

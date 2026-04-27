import type { MetadataRoute } from "next";
import { IS_TESTNET } from "@/config/solsab";

const siteUrl = IS_TESTNET
  ? "https://testnet.sol.ripguard.xyz"
  : "https://sol.ripguard.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/create`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/vaults`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];
}

import { BRAND } from "@/content/brand";
import { ogSize, renderSiteOGImage } from "@/lib/og-image";

// nodejs runtime (default) — see opengraph-image.tsx for rationale.
export const alt = BRAND.ogAlt;
export const size = ogSize;
export const contentType = "image/png";

export default async function TwitterImage() {
  return renderSiteOGImage();
}

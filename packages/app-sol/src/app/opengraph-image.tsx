import { BRAND } from "@/content/brand";
import { ogSize, renderSiteOGImage } from "@/lib/og-image";

// nodejs runtime (default): we read the 3D padlock PNG from public/
// via node:fs/promises inside renderSiteOGImage, which edge runtime
// doesn't support. OG images are cached hard by Vercel anyway, so
// cold starts aren't in the hot path for social scrapers.
export const alt = BRAND.ogAlt;
export const size = ogSize;
export const contentType = "image/png";

export default async function OGImage() {
  return renderSiteOGImage();
}

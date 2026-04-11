import { BRAND } from "@/content/brand";
import { ogSize, renderSiteOGImage } from "@/lib/og-image";

export const runtime = "edge";
export const alt = BRAND.ogAlt;
export const size = ogSize;
export const contentType = "image/png";

export default async function OGImage() {
  return renderSiteOGImage();
}

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { IS_TESTNET } from "@/config/contracts";
import { BRAND } from "@/content/brand";

// Shared Open Graph / Twitter card for ripguard.xyz. Both
// `app/opengraph-image.tsx` and `app/twitter-image.tsx` call
// `renderSiteOGImage()` so the social previews stay in sync.

export const ogSize = { width: 1200, height: 630 };

/**
 * Fetch a Google Font at edge runtime and return its TTF bytes.
 *
 * Two tricks to make this reliable against Google Fonts' defaults:
 *
 * 1. Use an old Chrome User-Agent. Modern UAs get woff2, which Satori
 *    does not support. Chrome 41 (2015) predates woff2 support and
 *    forces Google Fonts to serve TTF instead.
 * 2. Use the `text=` query parameter to request only the glyphs we
 *    actually render on the card. Smaller subset, faster fetch, and
 *    Google Fonts' subset API is TTF-friendly with the old UA.
 *
 * Returns null on any failure so the caller can fall back to Satori's
 * bundled default fonts instead of crashing the OG route.
 */
async function loadGoogleFont(
  family: string,
  text: string,
  weight = 400,
): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(
      / /g,
      "+",
    )}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const cssRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36",
      },
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(
      /src:\s*url\((https:\/\/[^)]+?)\)\s*format\(['"]?(truetype|opentype)['"]?\)/,
    );
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Read a local image file from the Next.js public folder and return
 * it as a base64 data URL for embedding in Satori `<img>`. Uses
 * `node:fs/promises` so the OG routes need to run on the nodejs
 * runtime (not edge). Returns null on any failure so the caller can
 * render without the image.
 */
async function loadPublicImageAsDataUrl(
  publicRelativePath: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const buffer = await readFile(
      join(process.cwd(), "public", publicRelativePath),
    );
    const base64 = buffer.toString("base64");
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Render the shared RipGuard OG / Twitter card. Brand-consistent with
 * the landing page: tinted dark neutral background, steel-cyan accent,
 * asymmetric layout (copy left, 3D padlock right), Archivo Black headline.
 */
export async function renderSiteOGImage() {
  const siteHost = IS_TESTNET ? "testnet.ripguard.xyz" : "ripguard.xyz";

  // All rendered text, combined. Passed to Google Fonts as the subset
  // hint so both font files only carry the glyphs this card needs.
  const allText = [
    "Lock your winnings before you give them back.",
    "Built on Sablier",
    BRAND.tagline,
    siteHost,
    "Powered by Sablier v2.0",
    "Non-custodial · Immutable",
  ].join(" ");

  // Load fonts and the 3D padlock in parallel. Each is best-effort: if
  // any fails, we fall back to Satori's default font and/or drop the
  // mark rather than crashing the OG route.
  const [archivoBlackData, archivoData, markDataUrl] = await Promise.all([
    loadGoogleFont("Archivo Black", allText),
    loadGoogleFont("Archivo", allText, 500),
    loadPublicImageAsDataUrl("mark-288.png", "image/png"),
  ]);

  const fonts: Array<{
    name: string;
    data: ArrayBuffer;
    style: "normal";
    weight: 400 | 500;
  }> = [];
  if (archivoBlackData) {
    fonts.push({
      name: "Archivo Black",
      data: archivoBlackData,
      style: "normal",
      weight: 400,
    });
  }
  if (archivoData) {
    fonts.push({
      name: "Archivo",
      data: archivoData,
      style: "normal",
      weight: 500,
    });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          // Tinted dark neutral — sRGB equivalent of our --background
          // token (oklch(0.14 0.008 200)).
          background: "#0a1014",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Archivo",
        }}
      >
        {/* Ambient cyan glow — positioned upper-right like the landing hero backdrop */}
        <div
          style={{
            position: "absolute",
            top: "-280px",
            right: "-240px",
            width: "920px",
            height: "920px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(71,180,204,0.22) 0%, rgba(71,180,204,0.06) 45%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Secondary softer glow directly behind the mark */}
        <div
          style={{
            position: "absolute",
            top: "110px",
            right: "40px",
            width: "460px",
            height: "460px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(71,180,204,0.22) 0%, rgba(71,180,204,0.08) 40%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Content grid — asymmetric, left-dominant */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "80px 88px",
            zIndex: 1,
          }}
        >
          {/* Left column: eyebrow + headline + subhead */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
            }}
          >
            {/* Eyebrow with cyan hairline prefix */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "18px",
                marginBottom: "36px",
              }}
            >
              <div
                style={{
                  width: "54px",
                  height: "2px",
                  background: "#47b4cc",
                  opacity: 0.7,
                  display: "flex",
                }}
              />
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 500,
                  color: "#a6b2b8",
                  textTransform: "uppercase",
                  letterSpacing: "3px",
                  display: "flex",
                }}
              >
                Built on Sablier
              </span>
            </div>

            {/* Headline — Archivo Black, cyan payoff on the last phrase */}
            <div
              style={{
                fontFamily: "Archivo Black",
                fontSize: "92px",
                fontWeight: 400,
                color: "#f4f7f8",
                lineHeight: 0.94,
                letterSpacing: "-3px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span style={{ display: "flex" }}>Lock your winnings</span>
              <span style={{ display: "flex", color: "#47b4cc" }}>
                before you give them back.
              </span>
            </div>

            {/* Tagline */}
            <div
              style={{
                marginTop: "36px",
                fontSize: "28px",
                fontWeight: 500,
                color: "#a6b2b8",
                lineHeight: 1.4,
                display: "flex",
                maxWidth: "700px",
              }}
            >
              {BRAND.tagline}
            </div>
          </div>

          {/* Right column: 3D padlock mark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "320px",
              marginLeft: "32px",
            }}
          >
            {markDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={markDataUrl}
                width={300}
                height={300}
                alt=""
                style={{ display: "flex" }}
              />
            ) : null}
          </div>
        </div>

        {/* Footer — site host + protocol attribution */}
        <div
          style={{
            position: "absolute",
            bottom: "52px",
            left: "88px",
            right: "88px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "18px",
            fontWeight: 500,
            color: "#7c8a90",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <span style={{ display: "flex", color: "#a6b2b8" }}>{siteHost}</span>
            <span style={{ display: "flex", color: "#47b4cc" }}>·</span>
            <span style={{ display: "flex" }}>Powered by Sablier v2.0</span>
          </div>
          <span
            style={{
              display: "flex",
              fontSize: "16px",
              color: "#7c8a90",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            Non-custodial · Immutable
          </span>
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: fonts.length > 0 ? fonts : undefined,
    },
  );
}

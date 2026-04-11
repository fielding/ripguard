import { ImageResponse } from "next/og";
import { IS_TESTNET } from "@/config/contracts";
import { BRAND } from "@/content/brand";

// Shared Open Graph / Twitter card for ripguard.xyz. Both
// `app/opengraph-image.tsx` and `app/twitter-image.tsx` call
// `renderSiteOGImage()` so the social previews stay in sync.

export const ogSize = { width: 1200, height: 630 };

/**
 * Fetch a Google Font at edge runtime and return its TTF bytes.
 * Returns null on any failure so the caller can fall back to Satori's
 * bundled default fonts instead of crashing the OG route.
 */
async function loadGoogleFont(
  family: string,
  weight = 400,
): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&display=swap`;
    const cssRes = await fetch(url, {
      headers: {
        // Google Fonts serves different font files based on UA.
        // Asking for a modern browser gets us TTF-compatible files.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(
      /src:\s*url\((https:\/\/[^)]+?)\)\s+format\(['"](?:truetype|opentype)['"]\)/,
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
 * Inline RipGuard flat SVG mark. Satori supports basic SVG via <svg>, so
 * we duplicate the path set from `components/Brand.tsx` here rather than
 * importing, keeping the OG route self-contained on edge runtime.
 */
function RipGuardMarkSVG({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M80 10L121 26L149 59V101L121 134L80 150L39 134L11 101V59L39 26L80 10Z"
        fill="#07161C"
        stroke="#3DAFC2"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M80 26L111 38L133 64V96L111 122L80 134L49 122L27 96V64L49 38L80 26Z"
        fill="#0B1D24"
        stroke="#11414C"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M80 45L55 57V80C55 94 65 109 80 114C95 109 105 94 105 80V57L80 45Z"
        fill="#0D252D"
        stroke="#38A8BA"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M66 79V68C66 60.268 72.268 54 80 54C87.732 54 94 60.268 94 68V79"
        stroke="#7AD2E2"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect
        x="58"
        y="76"
        width="44"
        height="34"
        rx="8"
        fill="#12303A"
        stroke="#7AD2E2"
        strokeWidth="3"
      />
      <circle cx="80" cy="91" r="4.5" fill="#7AD2E2" />
      <path d="M80 95.5V101.5" stroke="#7AD2E2" strokeWidth="3" strokeLinecap="round" />
      <path d="M38 80H49" stroke="#184F59" strokeWidth="2" strokeLinecap="round" />
      <path d="M111 80H122" stroke="#184F59" strokeWidth="2" strokeLinecap="round" />
      <circle cx="80" cy="26" r="3" fill="#7AD2E2" fillOpacity="0.9" />
    </svg>
  );
}

/**
 * Render the shared RipGuard OG / Twitter card. Brand-consistent with
 * the landing page: tinted dark neutral background, steel-cyan accent,
 * asymmetric layout (copy left, mark right), Archivo Black headline.
 */
export async function renderSiteOGImage() {
  const siteHost = IS_TESTNET ? "testnet.ripguard.xyz" : "ripguard.xyz";

  // Fonts are best-effort. If Google Fonts is unreachable, Satori falls
  // back to its bundled defaults and the card still renders correctly.
  const [archivoBlackData, archivoData] = await Promise.all([
    loadGoogleFont("Archivo Black"),
    loadGoogleFont("Archivo", 500),
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
        {/* Secondary softer glow behind the mark */}
        <div
          style={{
            position: "absolute",
            top: "140px",
            right: "60px",
            width: "420px",
            height: "420px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(71,180,204,0.16) 0%, transparent 65%)",
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
                  fontWeight: 600,
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

          {/* Right column: flat brand mark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "280px",
              marginLeft: "40px",
            }}
          >
            <RipGuardMarkSVG size={260} />
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

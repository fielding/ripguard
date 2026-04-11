import { ImageResponse } from "next/og";
import { IS_TESTNET } from "@/config/contracts";
import { BRAND } from "@/content/brand";

export const runtime = "edge";
export const alt = BRAND.ogAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const siteHost = IS_TESTNET ? "testnet.ripguard.xyz" : "ripguard.xyz";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#0a0a0a",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Cyan glow accent */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            left: "50%",
            width: "800px",
            height: "800px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,200,255,0.12) 0%, transparent 70%)",
            transform: "translateX(-50%)",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
            zIndex: 1,
            padding: "0 80px",
          }}
        >
          <div
            style={{
              fontSize: "64px",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-2px",
              display: "flex",
            }}
          >
            {BRAND.name}
          </div>

          <div
            style={{
              fontSize: "36px",
              fontWeight: 600,
              color: "#e0e0e0",
              textAlign: "center",
              lineHeight: 1.3,
              display: "flex",
            }}
          >
            {BRAND.ogHeadline}
          </div>

          <div
            style={{
              fontSize: "22px",
              fontWeight: 400,
              color: "#888888",
              textAlign: "center",
              display: "flex",
            }}
          >
            {BRAND.ogSubhead}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "32px",
            display: "flex",
            gap: "16px",
            fontSize: "16px",
            color: "#555555",
          }}
        >
          <span style={{ display: "flex" }}>{siteHost}</span>
          <span style={{ display: "flex" }}>|</span>
          <span style={{ display: "flex" }}>Powered by Sablier v2.0</span>
        </div>
      </div>
    ),
    { ...size }
  );
}

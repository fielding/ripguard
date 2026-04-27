import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClientProviders } from "@/components/ClientProviders";
import { TestnetBanner } from "@/components/TestnetBanner";
import { IS_TESTNET } from "@/config/solsab";
import { BRAND, getSiteTitle } from "@/content/brand";
import "./globals.css";

// Force dynamic rendering — web3 app needs client-side wallet state
export const dynamic = "force-dynamic";

const archivo = Archivo({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const archivoBlack = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const siteUrl = IS_TESTNET
  ? "https://testnet.sol.ripguard.xyz"
  : "https://sol.ripguard.xyz";
const siteTitle = getSiteTitle({ testnet: IS_TESTNET });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // sRGB equivalent of --background oklch(0.14 0.008 200), tinted toward brand cyan
  themeColor: "#0a1014",
};

export const metadata: Metadata = {
  title: siteTitle,
  description: BRAND.metaDescription,
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  robots: IS_TESTNET
    ? { index: false, follow: false }
    : { index: true, follow: true },
  openGraph: {
    title: siteTitle,
    description: BRAND.metaDescription,
    type: "website",
    url: siteUrl,
    siteName: IS_TESTNET ? BRAND.testnetName : BRAND.name,
    // Image comes from `src/app/opengraph-image.tsx` (file-based convention).
    // Next.js auto-injects the og:image meta tag — no static reference needed.
  },
  twitter: {
    card: "summary_large_image",
    site: "@ripguardxyz",
    title: siteTitle,
    description: BRAND.metaDescription,
    // Image comes from `src/app/twitter-image.tsx` (file-based convention).
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${archivo.variable} ${archivoBlack.variable} antialiased bg-background text-foreground`}
      >
        <TestnetBanner />
        <ClientProviders>{children}</ClientProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

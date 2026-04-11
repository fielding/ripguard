import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClientProviders } from "@/components/ClientProviders";
import { TestnetBanner } from "@/components/TestnetBanner";
import { IS_TESTNET } from "@/config/contracts";
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
  ? "https://testnet.ripguard.xyz"
  : "https://ripguard.xyz";
const siteTitle = getSiteTitle({ testnet: IS_TESTNET });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: siteTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@ripguardxyz",
    title: siteTitle,
    description: BRAND.metaDescription,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Prevent "Cannot redefine property: ethereum" — wallet extensions
            and wagmi's injected connector both call Object.defineProperty on
            window.ethereum, and one of them sets configurable:false first.
            Patch defineProperty to swallow that specific collision. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var orig = Object.defineProperty;
                Object.defineProperty = function(obj, prop, desc) {
                  try {
                    return orig.call(Object, obj, prop, desc);
                  } catch(e) {
                    if (obj === window && prop === 'ethereum' &&
                        e instanceof TypeError) {
                      return obj;
                    }
                    throw e;
                  }
                };
              })();
            `,
          }}
        />
      </head>
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

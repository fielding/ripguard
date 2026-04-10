import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClientProviders } from "@/components/ClientProviders";
import { TestnetBanner } from "@/components/TestnetBanner";
import { IS_TESTNET } from "@/config/contracts";
import "./globals.css";

// Force dynamic rendering — web3 app needs client-side wallet state
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = IS_TESTNET
  ? "https://testnet.ripguard.xyz"
  : "https://ripguard.xyz";
const siteTitle = IS_TESTNET
  ? "RipGuard Testnet — Lock your winnings before you give them back"
  : "RipGuard — Lock your winnings before you give them back";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: siteTitle,
  description:
    "The \"I'm up, get me out\" button. Lock USDC into time-locked vaults on Base. Non-cancelable. Self-custodial. Powered by Sablier v2.0 audited contracts.",
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
    description:
      "The \"I'm up, get me out\" button. Lock USDC into time-locked vaults on Base. Non-cancelable. Self-custodial. Powered by Sablier v2.0 audited contracts.",
    type: "website",
    url: siteUrl,
    siteName: IS_TESTNET ? "RipGuard Testnet" : "RipGuard",
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
    description:
      "The \"I'm up, get me out\" button. Lock USDC into time-locked vaults on Base. Non-cancelable. Self-custodial. Powered by Sablier v2.0 audited contracts.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <TestnetBanner />
        <ClientProviders>{children}</ClientProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

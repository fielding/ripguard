import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/providers";
import { TestnetBanner } from "@/components/TestnetBanner";
import { WelcomeModal } from "@/components/WelcomeModal";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Web3 apps with browser-only APIs (WalletConnect/IndexedDB) cannot be statically prerendered
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RipGuard — Lock your winnings before you give them back",
  description:
    "The \"I'm up, get me out\" button. Lock USDC into time-locked vaults on Base. Non-cancelable. Self-custodial. Powered by Sablier. Unaudited beta.",
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
  metadataBase: new URL("https://ripguard.xyz"),
  openGraph: {
    title: "RipGuard — Lock your winnings before you give them back",
    description:
      "The \"I'm up, get me out\" button. Lock USDC into time-locked vaults on Base. Non-cancelable. Self-custodial. Powered by Sablier.",
    type: "website",
    url: "https://ripguard.xyz",
    siteName: "RipGuard",
  },
  twitter: {
    card: "summary_large_image",
    title: "RipGuard — Lock your winnings before you give them back",
    description:
      "The \"I'm up, get me out\" button. Lock USDC into time-locked vaults on Base. Non-cancelable. Self-custodial. Powered by Sablier.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
      >
        <TestnetBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

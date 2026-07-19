/**
 * Brand positioning copy — single source of truth for strings that appear
 * in multiple places (hero, SEO metadata, social share images, PWA manifest).
 *
 * One-off section copy (FAQ, trust points, founder story, etc.) stays inline
 * in the components where it's used. Only extract strings that would
 * otherwise drift out of sync across files.
 */

export const BRAND = {
  name: "RipGuard",
  shortName: "RipGuard",
  testnetName: "RipGuard Testnet",
  testnetShortName: "RG Testnet",

  // Core positioning
  headline: "Lock your winnings before you give them back.",
  tagline: `The "cash this out, don't let me play" button.`,
  description:
    "Drop USDC into a vault that pays you back on your own schedule, like a reload you designed for yourself. Non-custodial. Non-cancelable. Enforced on-chain by Sablier.",

  // SEO / share metadata (tighter than the hero description)
  metaDescription:
    `The "cash this out, don't let me play" button. Lock USDC into a reload you designed for yourself. Non-custodial. Non-cancelable. Powered by Sablier.`,

  // Social share image
  ogHeadline: "Lock your winnings before you give them back.",
  ogSubhead: `The "cash this out, don't let me play" button. Powered by Sablier.`,
  ogAlt: "RipGuard. Lock your winnings before you give them back.",

  // PWA install description
  manifestDescription:
    "Lock your crypto winnings into a reload you designed for yourself. Non-custodial. Non-cancelable. Powered by Sablier.",

  // Telegram support channel — footer link and error-toast fallback
  supportUrl: "https://t.me/ripguard_support",
} as const;

/**
 * Build the full page title for a given context.
 * Landing page uses the headline; sub-pages can pass their own suffix.
 * Uses middle-dot separators everywhere for visual consistency and to
 * keep em dashes out of user-facing strings (brand rule).
 */
export function getSiteTitle(options: { testnet: boolean; pageTitle?: string }): string {
  const brand = options.testnet ? BRAND.testnetName : BRAND.name;
  if (options.pageTitle) {
    return `${options.pageTitle} · ${brand}`;
  }
  return `${brand} · ${BRAND.headline.replace(/\.$/, "")}`;
}

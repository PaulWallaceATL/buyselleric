/**
 * Site configuration — buyselleric · Eric Adams
 */

/** Canonical site URL for metadata, OG tags, sitemap, and robots (not the preview hostname). */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://buyselleric.com";
}

export const siteConfig = {
  brandSlug: "buyselleric",
  name: "BuySellEric",
  agentName: "Eric Adams",
  tagline: "Buy with clarity. Sell with confidence.",
  description:
    "Eric Adams helps buyers find the right home and sellers move with a plan—from pricing and prep to negotiation and closing.",
  /** Override on Vercel with NEXT_PUBLIC_SITE_URL (e.g. https://www.buyselleric.com). */
  url: resolveSiteUrl(),
  email: "eric@buyselleric.com",
  phoneDisplay: "478-456-6650",
  phoneTel: "+14784566650",
  license: "DRE #00000000",
  primaryMarket: "Your metro area",

  /** CrossCountry Mortgage — application with Eric as referrer */
  mortgageApplicationUrl:
    "https://app.crosscountrymortgage.com/#/choose-loan-type?referrerId=eric.adams%40ccm.com",

  nav: {
    cta: {
      text: "List your home",
      href: "/sell",
    },
  },
} as const;

export const features = {
  smoothScroll: true,
  darkMode: true,
} as const;

export const themeConfig = {
  defaultTheme: "dark" as const,
  enableSystem: true,
} as const;

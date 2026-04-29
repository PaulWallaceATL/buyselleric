/**
 * Site configuration — buyselleric
 */

function hostnameOf(urlish: string): string | null {
  try {
    const u = urlish.includes("://") ? new URL(urlish) : new URL(`https://${urlish}`);
    return u.hostname || null;
  } catch {
    return null;
  }
}

function isVercelDeploymentHost(hostname: string | null): boolean {
  if (!hostname) {
    return true;
  }
  return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
}

/**
 * Canonical site URL for metadata, OG tags, sitemap, and robots.
 * Ignores NEXT_PUBLIC_SITE_URL when it still points at *.vercel.app (common dashboard
 * default); prefers Vercel’s production hostname when it is a real domain.
 */
function resolveSiteUrl(): string {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const explicitRaw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
  const explicitHost = explicitRaw ? hostnameOf(explicitRaw) : null;
  if (
    explicitRaw &&
    explicitHost &&
    !isVercelDeploymentHost(explicitHost)
  ) {
    return explicitRaw.startsWith("http") ? explicitRaw : `https://${explicitRaw}`;
  }

  const vercelProd =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ??
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    const host = hostnameOf(vercelProd.includes("://") ? vercelProd : `https://${vercelProd}`);
    if (host && !isVercelDeploymentHost(host)) {
      return vercelProd.startsWith("http") ? vercelProd.replace(/\/$/, "") : `https://${vercelProd.replace(/^\/+/, "")}`;
    }
  }

  if (process.env.NODE_ENV === "development") {
    if (
      explicitRaw &&
      explicitHost &&
      !isVercelDeploymentHost(explicitHost)
    ) {
      return explicitRaw.startsWith("http") ? explicitRaw : `https://${explicitRaw}`;
    }
    return "http://localhost:3000";
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
  /** Shown under the tagline in the site footer (licensing / affiliations). */
  footerCredentialLines: [
    "CrossCountry Mortgage",
    "Loan Officer",
    "Greensboro, GA Mortgage Loan Officer",
    "NMLS #1245446",
    "Georgia real estate salesperson · License #447520",
    "Southern Classic Realty",
  ],
  primaryMarket: "All of Georgia",

  /** Public profiles (About + optional links). */
  instagramUrl: "https://www.instagram.com/buyselleric/",
  georgiaMlsAgentUrl: "https://www.georgiamls.com/real-estate-agents/JA7014",

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

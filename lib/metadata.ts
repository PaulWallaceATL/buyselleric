import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
import { absoluteResourceUrl, truncateMetaDescription } from "@/lib/seo";

export { siteConfig };

/** Always set in meta tags — `app/opengraph-image.tsx` serves the PNG (icon + Buy/Sell/Eric). */
export const defaultSocialImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
} as const;

export const seoKeywords = [
  "real estate",
  "homes for sale",
  "realtor",
  "buy a home",
  "sell a home",
  siteConfig.agentName,
  siteConfig.brandSlug,
  "Eric Adams real estate",
] as const;

export const baseMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} · ${siteConfig.agentName}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...seoKeywords],
  authors: [{ name: siteConfig.agentName, url: siteConfig.url }],
  creator: siteConfig.agentName,
  publisher: siteConfig.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: `${siteConfig.name} · ${siteConfig.agentName}`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [{ ...defaultSocialImage, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} · ${siteConfig.agentName}`,
    description: siteConfig.description,
    images: [defaultSocialImage.url],
  },
  /** Tab + PWA: `app/icon.svg` + `app/apple-icon.svg` (house). Do not add `app/favicon.ico` — the default is the Vercel triangle and it is listed before SVG in `<head>`. */
  manifest: "/site.webmanifest",
};

export function createMetadata({
  title,
  description,
  path = "/",
  image,
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${siteConfig.url}${path}`;
  const desc =
    description != null && description !== ""
      ? truncateMetaDescription(description)
      : siteConfig.description;
  const ogImageUrl = image
    ? absoluteResourceUrl(siteConfig.url, image) ?? image
    : absoluteResourceUrl(siteConfig.url, defaultSocialImage.url) ?? defaultSocialImage.url;
  return {
    title,
    description: desc,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: title ?? siteConfig.name,
      description: desc,
      url,
      images: ogImageUrl
        ? [{ url: ogImageUrl, width: 1200, height: 630, alt: title ?? siteConfig.name }]
        : [{ ...defaultSocialImage, alt: title ?? siteConfig.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: title ?? siteConfig.name,
      description: desc,
      images: [ogImageUrl],
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}

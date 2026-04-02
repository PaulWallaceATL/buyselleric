import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;
  const lastModified = new Date();

  return [
    { url: baseUrl, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/listings`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/sell`, lastModified, changeFrequency: "monthly", priority: 0.8 },
  ];
}

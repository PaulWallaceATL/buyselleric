import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { siteConfig } from "@/lib/metadata";

async function blogSitemapUrls(baseUrl: string): Promise<MetadataRoute.Sitemap> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return [];

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, updated_at, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (error || !data?.length) return [];

  return data.map((row) => {
    const r = row as { slug: string; updated_at: string; published_at: string | null };
    const lm = r.updated_at || r.published_at;
    return {
      url: `${baseUrl}/blog/${r.slug}`,
      lastModified: lm ? new Date(lm) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.65,
    };
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/listings`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/sell`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified, changeFrequency: "weekly", priority: 0.75 },
  ];

  const posts = await blogSitemapUrls(baseUrl);
  return [...staticEntries, ...posts];
}

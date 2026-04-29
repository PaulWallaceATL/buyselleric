/**
 * SERP-oriented helpers (meta description length, absolute URLs for OG/Twitter).
 */

const META_DESC_SOFT_MAX = 155;

/** Strip tags for safe plain-text meta / schema descriptions (remarks may contain HTML). */
export function stripHtmlLoose(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trims to a sensible meta description length (Google typically shows ~150–160 characters).
 * Breaks on word boundary when possible.
 */
export function truncateMetaDescription(text: string, maxChars: number = META_DESC_SOFT_MAX): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;

  const slice = t.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 40) return `${slice.slice(0, lastSpace).trimEnd()}…`;
  return `${slice.trimEnd()}…`;
}

/** Resolve relative paths (e.g. /opengraph-image) against the site origin for crawlers and social cards. */
export function absoluteResourceUrl(origin: string, resource: string | null | undefined): string | null {
  if (!resource?.trim()) return null;
  const u = resource.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  const base = origin.replace(/\/$/, "");
  const path = u.startsWith("/") ? u : `/${u}`;
  return `${base}${path}`;
}

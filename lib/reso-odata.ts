/**
 * RESO Web API helpers shared by every OData feed (Bridge, Spark, …).
 *
 * Anything that mutates a vendor-specific URL/auth lives in the per-feed
 * module. Anything that operates on standardized RESO fields (Property,
 * Media, etc.) belongs here so we map photos and remarks the same way
 * regardless of upstream provider.
 */

export interface ODataValueResponse<T> {
  value?: T[];
  /** @odata.count when $count=true */
  ["@odata.count"]?: number;
  /** Paging cursor for $top + $skip + nextLink. */
  ["@odata.nextLink"]?: string;
}

/**
 * Best single URL per media row — same preference order across feeds so we do
 * not store thumbnail + midsize + full as separate gallery slots.
 */
export function bestPhotoUrlFromMediaRow(m: Record<string, unknown>): string {
  const preference = [
    "OriginalURL",
    "MediaURLFull",
    "MediaURLHiRes",
    "MediaURL",
    "MediaMidsizeURL",
    "MediaThumbnailURL",
    "ImageURL",
    "PhotoURL",
    "URL",
    "Url",
  ] as const;
  for (const k of preference) {
    const v = m[k];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  for (const v of Object.values(m)) {
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return "";
}

function mediaRowPreferred(m: Record<string, unknown>): boolean {
  const p = m.PreferredPhoto;
  return p === true || p === "Y" || p === "y" || p === "true" || p === "1" || p === 1;
}

function mediaRowOrder(m: Record<string, unknown>): number {
  const o = m.Order ?? m.MediaOrder ?? m.ImageOrderPrimary;
  const n = typeof o === "number" ? o : Number.parseFloat(String(o ?? "999"));
  return Number.isFinite(n) ? n : 999;
}

function dedupeUrlsPreserveOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = u.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Normalize Media JSON (array, @odata.bind wrapper, or { value }) into rows. */
export function normalizeMediaRows(media: unknown): Record<string, unknown>[] {
  if (media == null) return [];
  if (Array.isArray(media)) {
    return media.filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === "object");
  }
  if (typeof media === "object") {
    const o = media as Record<string, unknown>;
    if (Array.isArray(o.value)) {
      return o.value.filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === "object");
    }
  }
  return [];
}

/** Ordered photo URLs from inline `Media` on a Property row (or Media entity rows). */
export function extractOrderedPhotoUrlsFromMediaRows(rows: Record<string, unknown>[]): string[] {
  const scored = rows
    .map((m) => ({
      preferred: mediaRowPreferred(m),
      order: mediaRowOrder(m),
      url: bestPhotoUrlFromMediaRow(m),
    }))
    .filter((x) => /^https?:\/\//i.test(x.url));

  scored.sort((a, b) => {
    if (a.preferred && !b.preferred) return -1;
    if (!a.preferred && b.preferred) return 1;
    return a.order - b.order;
  });

  return dedupeUrlsPreserveOrder(scored.map((s) => s.url));
}

export function extractMediaUrls(media: unknown): string[] {
  return extractOrderedPhotoUrlsFromMediaRows(normalizeMediaRows(media));
}

export function isLikelyImageUrl(u: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif|bmp)(\?|$)/i.test(u) || /format=(webp|jpeg|jpg|png)/i.test(u);
}

/** CDN/signed URLs often omit extensions; still treat as photos unless clearly documents/video. */
export function isProbablyDisplayablePhotoUrl(u: string): boolean {
  const t = u.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  if (isLikelyImageUrl(t)) return true;
  if (/\.(pdf|docx?|xlsx?|zip|mp4|mov|webm|m4v|wmv)(\?|$)/i.test(t)) return false;
  if (/photo|image|img|pictures|resize|thumbnail|cdn|cloudfront|bridgedataoutput|sparkapi|flexmls|mlspin|brightmls/i.test(t))
    return true;
  return false;
}

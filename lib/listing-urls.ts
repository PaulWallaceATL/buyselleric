import type { UnifiedListing } from "@/lib/listings-queries";

/** Written when RETS returns no media so photo backfill can advance past the row. */
export const MLS_NO_PHOTOS_SENTINEL = "__no_mls_photos__" as const;

export function listingDetailHref(listing: UnifiedListing): string {
  if (listing.source === "manual" && listing.slug) {
    return `/listings/${listing.slug}`;
  }
  if (listing.mls_id) {
    return `/listings/mls/${listing.mls_id}`;
  }
  return "/listings";
}

export function filterDisplayImageUrls(urls: string[] | null | undefined): string[] {
  return (urls ?? []).filter((u) => Boolean(u) && u !== MLS_NO_PHOTOS_SENTINEL);
}

/**
 * ConnectMLS / GAMLS CDN often returns soft midsize URLs like `?width=1080`.
 * Detail galleries render wider than that — bump the resize param so intrinsic
 * width meets the layout (and retina). No-op for other hosts or already-large widths.
 */
export function upgradeMlsPhotoUrlForDetail(src: string): string {
  const raw = src.trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    const isConnectMls =
      h.endsWith(".connectmls.com") ||
      h.endsWith(".cdn-connectmls.com") ||
      h.includes("connectmls");
    if (!isConnectMls) return raw;

    const DETAIL_WIDTH = 2400;
    const existing = u.searchParams.get("width");
    if (existing != null) {
      const n = Number.parseInt(existing, 10);
      if (Number.isFinite(n) && n > 0 && n < DETAIL_WIDTH) {
        u.searchParams.set("width", String(DETAIL_WIDTH));
        return u.toString();
      }
      return raw;
    }
    // Some ConnectMLS variants only expose a default midsize without width —
    // requesting an explicit large width usually returns a sharper asset.
    u.searchParams.set("width", String(DETAIL_WIDTH));
    return u.toString();
  } catch {
    return raw;
  }
}

export function upgradeMlsPhotoUrlsForDetail(urls: string[]): string[] {
  return urls.map(upgradeMlsPhotoUrlForDetail);
}

/**
 * Some CDNs allow browser hotlinks but block Next’s image optimizer (or return
 * soft/blurry proxies). Prefer the original URL in the browser for MLS photos.
 */
export function listingImagePreferUnoptimized(src: string): boolean {
  try {
    const h = new URL(src.trim()).hostname.toLowerCase();
    if (h === "zillowstatic.com" || h.endsWith(".zillowstatic.com")) return true;
    if (h.endsWith(".cdninstagram.com") || h.endsWith(".fbcdn.net")) return true;
    // GAMLS / ConnectMLS / Bridge photo hosts — optimizer often downscales soft
    if (h.endsWith(".connectmls.com") || h.endsWith(".cdn-connectmls.com")) return true;
    if (h.endsWith(".gamls.com") || h.includes("gamls")) return true;
    if (h.endsWith(".sparkplatform.com") || h.endsWith(".bridgedataoutput.com")) return true;
    if (h.endsWith(".amazonaws.com") || h.endsWith(".cloudfront.net")) return true;
    return false;
  } catch {
    return false;
  }
}

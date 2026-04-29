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
 * Some CDNs (e.g. Zillow) allow browser hotlinks but block Next’s image optimizer fetch.
 * Use with next/image `unoptimized` so the URL loads in the browser like admin previews (no optimizer proxy).
 */
export function listingImagePreferUnoptimized(src: string): boolean {
  try {
    const h = new URL(src.trim()).hostname.toLowerCase();
    return h === "zillowstatic.com" || h.endsWith(".zillowstatic.com");
  } catch {
    return false;
  }
}

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

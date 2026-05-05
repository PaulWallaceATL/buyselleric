import type { ListingFeed, UnifiedListing } from "@/lib/listings-queries";

export interface FeedLabel {
  /** Short pill label shown on listing cards (e.g. "GAMLS", "Mid-GA MLS"). */
  short: string;
  /** Long-form name used in tooltips and JSON-LD attribution. */
  long: string;
  /** Tailwind classes for the small pill on cards / map tooltips. */
  pillClass: string;
}

/** Map each feed → human-readable label. Edit when onboarding new MLS sources. */
export function feedLabel(feed: ListingFeed | undefined): FeedLabel | null {
  switch (feed) {
    case "bridge":
      return {
        short: "GAMLS",
        long: "Georgia MLS · Bridge Interactive",
        pillClass: "bg-sky-600/90 text-white",
      };
    case "spark":
      return {
        short: "Mid-GA MLS",
        long: "Middle Georgia MLS · Spark Platform",
        pillClass: "bg-emerald-600/90 text-white",
      };
    case "manual":
      return {
        short: "Eric",
        long: "Eric Adams · curated listing",
        pillClass: "bg-amber-500/90 text-white",
      };
    default:
      return null;
  }
}

/** Convenience for cards/popups/etc. — derives from `listing.feed` first, falls back to `listing.source`. */
export function feedLabelForListing(listing: Pick<UnifiedListing, "feed" | "source">): FeedLabel | null {
  if (listing.feed) return feedLabel(listing.feed);
  if (listing.source === "manual") return feedLabel("manual");
  return null;
}

import Link from "next/link";
import { UnifiedListingCard } from "@/components/unified-listing-card";
import { siteConfig } from "@/lib/config";
import { ctaMutedOutline, ctaPrimary } from "@/lib/cta-styles";
import { getFeaturedUnifiedListings } from "@/lib/listings-queries";
import { eyebrow, lead, sectionTitle, sectionY, siteContainer } from "@/lib/ui";

export async function FeaturedListings() {
  const featured = await getFeaturedUnifiedListings();

  return (
    <section id="featured-listings" className={`featured-listings bg-background ${sectionY}`}>
      <div className={siteContainer}>
        <div className="mb-10 flex flex-col gap-6 sm:mb-14 lg:mb-16 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className={eyebrow}>{siteConfig.agentName}</p>
            <h2 className={`${sectionTitle} mt-3`}>Featured homes</h2>
            <p className={`${lead} mt-3 max-w-xl`}>
              A curated look at current opportunities. Full details and more listings are one click away.
            </p>
          </div>
          <Link href="/listings" className={`${ctaPrimary} shrink-0 lg:self-end`}>
            View all listings
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center sm:px-8 sm:py-10">
            <p className="text-foreground font-medium">Featured homes will show here once you pick them.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose MLS or manual listings in the admin Featured panel.
            </p>
            <Link href="/listings" className={`${ctaMutedOutline} mt-6`}>
              Browse all listings
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((l) => (
              <UnifiedListingCard key={`${l.source}-${l.mls_id ?? l.id}`} listing={l} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

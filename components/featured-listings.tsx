import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { siteConfig } from "@/lib/config";
import { ctaMutedOutline, ctaPrimary } from "@/lib/cta-styles";
import { getPublishedListings } from "@/lib/listings-queries";
import { eyebrow, lead, sectionTitle, sectionY, siteContainer } from "@/lib/ui";

export async function FeaturedListings() {
  const listings = await getPublishedListings();
  const featured = listings.slice(0, 3);

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
          <div className="rounded-3xl border border-dashed border-border bg-muted/20 p-8 text-center sm:p-12">
            <p className="text-foreground font-medium">Listings will appear here once published.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect Supabase and add homes from the admin panel.
            </p>
            <Link href="/sell" className={`${ctaMutedOutline} mt-6`}>
              Sell with Eric
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

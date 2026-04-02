import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { getPublishedListings } from "@/lib/listings-queries";
import { siteConfig } from "@/lib/config";

export async function FeaturedListings() {
  const listings = await getPublishedListings();
  const featured = listings.slice(0, 3);

  return (
    <section id="featured-listings" className="featured-listings bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-360 px-6 sm:px-12 lg:px-24 2xl:max-w-450 3xl:max-w-550">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between mb-12 lg:mb-16">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              {siteConfig.agentName}
            </p>
            <h2 className="mt-2 text-4xl lg:text-5xl font-medium tracking-tight text-foreground">
              Featured homes
            </h2>
            <p className="mt-3 max-w-xl text-lg text-muted-foreground">
              A curated look at current opportunities. Full details and more listings are one click away.
            </p>
          </div>
          <Link
            href="/listings"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            View all listings
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
            <p className="text-foreground font-medium">Listings will appear here once published.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect Supabase and add homes from the admin panel.
            </p>
            <Link
              href="/sell"
              className="mt-6 inline-flex rounded-full border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted/40"
            >
              Sell with Eric
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

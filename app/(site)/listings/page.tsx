import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { ListingsMapView } from "@/components/listings-map-view";
import { ListingsSearchBar } from "@/components/listings-search-bar";
import { siteConfig } from "@/lib/config";
import { ctaPrimary } from "@/lib/cta-styles";
import { getPublishedListings, searchListings } from "@/lib/listings-queries";
import { eyebrow, lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import { createMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const revalidate = 60;

export const metadata: Metadata = createMetadata({
  title: "Homes for sale",
  description: `Browse available homes with ${siteConfig.agentName}. Local expertise, clear guidance, and a smoother path to closing.`,
  path: "/listings",
});

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const view = typeof params.view === "string" ? params.view : "list";

  const listings = query ? await searchListings(query) : await getPublishedListings();

  return (
    <main id="main-content" className={pageMain}>
      <div className={siteContainer}>
        <p className={eyebrow}>{siteConfig.brandSlug}</p>
        <h1 className={`${sectionTitle} mt-3`}>
          {query ? "Search results" : "Available homes"}
        </h1>
        <p className={`${lead} mt-4`}>
          {query
            ? `Showing homes matching "${query}"`
            : "Every listing is presented with honest details and professional photography when available. Reach out for private showings or off-market opportunities."}
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ListingsSearchBar defaultValue={query} />
          <ViewToggle query={query} activeView={view} />
        </div>

        {listings.length === 0 ? (
          <EmptyState query={query} />
        ) : view === "map" ? (
          <div className="mt-10">
            <ListingsMapView listings={listings} />
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ViewToggle({ query, activeView }: { query: string; activeView: string }) {
  const base = query ? `/listings?q=${encodeURIComponent(query)}` : "/listings";
  const listHref = query ? `${base}&view=list` : `${base}?view=list`;
  const mapHref = query ? `${base}&view=map` : `${base}?view=map`;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href={listHref}
        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          activeView !== "map"
            ? "bg-foreground text-background"
            : "border border-border text-foreground hover:bg-muted/30"
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        List
      </Link>
      <Link
        href={mapHref}
        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          activeView === "map"
            ? "bg-foreground text-background"
            : "border border-border text-foreground hover:bg-muted/30"
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        Map
      </Link>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-border bg-muted/20 p-10 text-center sm:mt-12 sm:p-12">
      <p className="text-foreground font-medium">
        {query ? `No homes found matching "${query}"` : "No published listings yet."}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {query
          ? "Try a different search term, or browse all available listings."
          : "Check back soon—or tell Eric what you are looking for."}
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {query && (
          <Link href="/listings" className={ctaPrimary}>
            View all listings
          </Link>
        )}
        <Link
          href="/sell"
          className={query ? "text-sm font-medium text-ring underline underline-offset-4" : ctaPrimary}
        >
          Start a seller conversation
        </Link>
      </div>
    </div>
  );
}

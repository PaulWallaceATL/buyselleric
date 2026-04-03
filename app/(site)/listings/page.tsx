import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { siteConfig } from "@/lib/config";
import { getPublishedListings } from "@/lib/listings-queries";
import { createMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const revalidate = 60;

export const metadata: Metadata = createMetadata({
  title: "Homes for sale",
  description: `Browse available homes with ${siteConfig.agentName}. Local expertise, clear guidance, and a smoother path to closing.`,
  path: "/listings",
});

export default async function ListingsPage(): Promise<ReactNode> {
  const listings = await getPublishedListings();

  return (
    <main
      id="main-content"
      className="min-h-screen bg-background px-6 pb-24 pt-28 sm:px-12 lg:px-24 lg:relative lg:z-10"
    >
      <div className="mx-auto max-w-360 2xl:max-w-450 3xl:max-w-550">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          {siteConfig.brandSlug}
        </p>
        <h1 className="mt-2 text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          Available homes
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Every listing is presented with honest details and professional photography when available.
          Reach out for private showings or off-market opportunities.
        </p>

        {listings.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
            <p className="text-foreground font-medium">No published listings yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back soon—or tell Eric what you are looking for.
            </p>
            <Link
              href="/sell"
              className="mt-6 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
            >
              Start a seller conversation
            </Link>
          </div>
        ) : (
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

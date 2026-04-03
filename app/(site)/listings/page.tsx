import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { siteConfig } from "@/lib/config";
import { ctaPrimary } from "@/lib/cta-styles";
import { getPublishedListings } from "@/lib/listings-queries";
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

export default async function ListingsPage(): Promise<ReactNode> {
  const listings = await getPublishedListings();

  return (
    <main id="main-content" className={pageMain}>
      <div className={siteContainer}>
        <p className={eyebrow}>{siteConfig.brandSlug}</p>
        <h1 className={`${sectionTitle} mt-3`}>Available homes</h1>
        <p className={`${lead} mt-4`}>
          Every listing is presented with honest details and professional photography when available.
          Reach out for private showings or off-market opportunities.
        </p>

        {listings.length === 0 ? (
          <div className="mt-14 rounded-3xl border border-dashed border-border bg-muted/20 p-10 text-center sm:mt-16 sm:p-12">
            <p className="text-foreground font-medium">No published listings yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back soon—or tell Eric what you are looking for.
            </p>
            <Link href="/sell" className={`${ctaPrimary} mt-6`}>
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

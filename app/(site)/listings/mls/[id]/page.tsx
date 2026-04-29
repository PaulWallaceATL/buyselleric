import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingGallery } from "@/components/listing-gallery";
import { siteConfig } from "@/lib/config";
import { ctaPrimary, ctaSecondary } from "@/lib/cta-styles";
import { formatPriceUsd } from "@/lib/format";
import { filterDisplayImageUrls } from "@/lib/listing-urls";
import { getMlsListingById } from "@/lib/listings-queries";
import { createMetadata } from "@/lib/metadata";
import { pageMain, siteContainer } from "@/lib/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type Props = Readonly<{ params: Promise<{ id: string }> }>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getMlsListingById(id);
  if (!listing) return {};
  const title = listing.title || `${listing.address_line}, ${listing.city}`;
  return createMetadata({
    title,
    description: `${formatPriceUsd(listing.price_cents)} · ${listing.bedrooms} bd · ${listing.bathrooms} ba in ${listing.city}, ${listing.state}`,
    path: `/listings/mls/${id}`,
  });
}

export default async function MlsListingPage({ params }: Props): Promise<ReactNode> {
  const { id } = await params;
  const listing = await getMlsListingById(id);
  if (!listing) notFound();

  const title = listing.title || `${listing.address_line}, ${listing.city}`;
  const location = [listing.address_line, listing.city, listing.state, listing.postal_code]
    .filter(Boolean)
    .join(", ");
  const galleryUrls = filterDisplayImageUrls(listing.image_urls);

  return (
    <main id="main-content" className={pageMain}>
      <div className={`${siteContainer} max-w-4xl`}>
        <Link
          href="/listings"
          className="relative z-20 inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          ← Back to listings
        </Link>

        {galleryUrls.length > 0 && (
          <div className="mt-6">
            <ListingGallery urls={galleryUrls} />
          </div>
        )}

        <div className="mt-8">
          <span className="rounded-full bg-ring/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
            MLS #{listing.mls_id}
          </span>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{location}</p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-muted/20 p-4 text-center">
            <p className="text-2xl font-bold text-foreground sm:text-3xl">{formatPriceUsd(listing.price_cents)}</p>
            <p className="mt-1 text-sm text-muted-foreground">List price</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/20 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{listing.bedrooms}</p>
            <p className="mt-1 text-sm text-muted-foreground">Bedrooms</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/20 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{listing.bathrooms}</p>
            <p className="mt-1 text-sm text-muted-foreground">Bathrooms</p>
          </div>
          {listing.square_feet && (
            <div className="rounded-2xl border border-border bg-muted/20 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{listing.square_feet.toLocaleString()}</p>
              <p className="mt-1 text-sm text-muted-foreground">Sq ft</p>
            </div>
          )}
        </div>

        {listing.description && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold text-foreground">Description</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
              {listing.description}
            </p>
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {listing.property_type && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Property type</p>
              <p className="mt-1 text-foreground">{listing.property_type}</p>
            </div>
          )}
          {listing.listing_agent && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Listing agent</p>
              <p className="mt-1 text-foreground">{listing.listing_agent}</p>
            </div>
          )}
          {listing.listing_office && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Listing office</p>
              <p className="mt-1 text-foreground">{listing.listing_office}</p>
            </div>
          )}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-muted/20 p-6 sm:rounded-3xl sm:p-8">
          <h2 className="text-xl font-semibold text-foreground">Interested in this home?</h2>
          <p className="mt-2 text-base text-muted-foreground">
            Contact {siteConfig.agentName} for a private showing or more information about this property.
          </p>
          <div className="mt-6 flex flex-row flex-wrap gap-3">
            <a href={`mailto:${siteConfig.email}?subject=Inquiry about ${title}`} className={ctaPrimary}>
              Email {siteConfig.agentName}
            </a>
            <a href={`tel:${siteConfig.phoneTel}`} className={ctaSecondary}>
              Call {siteConfig.phoneDisplay}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

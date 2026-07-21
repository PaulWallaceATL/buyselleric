import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingGallery } from "@/components/listing-gallery";
import { ListingInquiryForm } from "@/components/listing-inquiry-form";
import { ListingStickyCta } from "@/components/listing-sticky-cta";
import { siteConfig } from "@/lib/config";
import { ctaMortgage, ctaSecondary } from "@/lib/cta-styles";
import { formatPriceUsd } from "@/lib/format";
import { buildMlsListingJsonLd } from "@/lib/jsonld-mls-listing";
import { filterDisplayImageUrls } from "@/lib/listing-urls";
import { getMlsListingById } from "@/lib/listings-queries";
import { createMetadata } from "@/lib/metadata";
import {
  hasListingFirmName,
  resolveMlsAttribution,
  mlsAttributionLinks,
} from "@/lib/mls-attribution";
import { stripHtmlLoose, truncateMetaDescription } from "@/lib/seo";
import { siteContainer, listingHeroTopPadding } from "@/lib/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const revalidate = 60;

type Props = Readonly<{ params: Promise<{ id: string }> }>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getMlsListingById(id);
  if (!listing) {
    return {
      title: "Listing",
      robots: { index: false, follow: false },
    };
  }
  const title = listing.title || `${listing.address_line}, ${listing.city}`;
  const fallback = `${formatPriceUsd(listing.price_cents)} · ${listing.bedrooms} bd · ${listing.bathrooms} ba in ${listing.city}, ${listing.state}`;
  const plain = stripHtmlLoose(listing.description || "");
  const description = truncateMetaDescription(plain.length >= 45 ? plain : fallback);
  const galleryUrls = filterDisplayImageUrls(listing.image_urls);
  const firstImage = galleryUrls[0];

  return createMetadata({
    title,
    description,
    path: `/listings/mls/${id}`,
    ...(firstImage ? { image: firstImage } : {}),
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
  const pageUrl = `${siteConfig.url}/listings/mls/${id}`;
  const jsonLd = buildMlsListingJsonLd(listing, pageUrl, siteConfig.url);
  const attribution = resolveMlsAttribution(listing);
  const links = mlsAttributionLinks(listing);
  const hasFirm = hasListingFirmName(listing);
  const hasAgentBits = Boolean(
    attribution.listing_agent ||
      attribution.listing_agent_phone ||
      attribution.listing_agent_email ||
      attribution.listing_agent_url,
  );

  if (!hasFirm) {
    console.warn(
      `MLS listing firm missing for ${listing.mls_id} after Bridge/Spark/RETS — feed may omit OfficeName`,
    );
  }

  return (
    <main
      id="main-content"
      className="relative z-10 w-full flex-1 bg-background pb-28 sm:pb-28 lg:pb-24"
      style={listingHeroTopPadding}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="w-full">
        <ListingGallery urls={galleryUrls} variant="fullBleed" />
      </div>

      <div className={`${siteContainer} max-w-5xl pt-8 sm:pt-10`}>
        <Link
          href="/listings"
          className="relative z-20 inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          ← Back to listings
        </Link>

        <div className="mt-8 sm:mt-10">
          <span className="inline-block rounded-sm bg-ring/90 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white">
            For sale
          </span>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground uppercase sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {listing.address_line || title}
          </h1>
          <p className="mt-2 text-sm uppercase tracking-wide text-muted-foreground sm:text-base">
            {location}
          </p>
          <div className="mt-6 border-t border-border pt-6">
            <p className="text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
              {formatPriceUsd(listing.price_cents)}
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            {listing.description ? (
              <p className="whitespace-pre-line text-base leading-relaxed text-muted-foreground sm:text-lg">
                {listing.description}
              </p>
            ) : null}
            {listing.property_type ? (
              <p className="mt-8 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Property type</span>
                <span className="mt-1 block">{listing.property_type}</span>
              </p>
            ) : null}
          </div>

          <aside className="space-y-5 lg:col-span-5">
            <ul className="space-y-4 text-sm font-medium uppercase tracking-wide text-foreground sm:text-base">
              <li className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-3">
                <span className="text-muted-foreground">Beds</span>
                <span className="tabular-nums">{listing.bedrooms}</span>
              </li>
              <li className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-3">
                <span className="text-muted-foreground">Baths</span>
                <span className="tabular-nums">{listing.bathrooms}</span>
              </li>
              {listing.square_feet ? (
                <li className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-3">
                  <span className="text-muted-foreground">Living area</span>
                  <span className="tabular-nums">{listing.square_feet.toLocaleString()} sq ft</span>
                </li>
              ) : null}
            </ul>
          </aside>
        </div>

        <div className="mt-12 space-y-6">
          <ListingInquiryForm
            listingSource="mls"
            listingId={listing.mls_id}
            listingTitle={title}
            listingPath={`/listings/mls/${id}`}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={`tel:${siteConfig.phoneTel}`} className={ctaSecondary}>
              Call {siteConfig.phoneDisplay}
            </a>
            <a
              href={siteConfig.mortgageApplicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={ctaMortgage}
            >
              Get pre-approved
            </a>
          </div>
        </div>

        <div className="mt-6 space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
          {hasFirm ? (
            <>
              <p>
                <span className="text-muted-foreground/70">Listed by: </span>
                <span>{attribution.listing_office}</span>
                {attribution.listing_office_phone ? (
                  <>
                    {" · "}
                    {links.officeTel ? (
                      <a href={links.officeTel} className="underline-offset-2 hover:underline">
                        {attribution.listing_office_phone}
                      </a>
                    ) : (
                      attribution.listing_office_phone
                    )}
                  </>
                ) : null}
                {attribution.listing_office_email ? (
                  <>
                    {" · "}
                    {links.officeMailto ? (
                      <a href={links.officeMailto} className="underline-offset-2 hover:underline">
                        {attribution.listing_office_email}
                      </a>
                    ) : (
                      attribution.listing_office_email
                    )}
                  </>
                ) : null}
                {links.officeWeb ? (
                  <>
                    {" · "}
                    <a
                      href={links.officeWeb}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      Website
                    </a>
                  </>
                ) : null}
              </p>
              {hasAgentBits ? (
                <p>
                  <span className="text-muted-foreground/70">Listing agent: </span>
                  {attribution.listing_agent ? <span>{attribution.listing_agent}</span> : null}
                  {attribution.listing_agent_phone ? (
                    <>
                      {attribution.listing_agent ? " · " : null}
                      {links.agentTel ? (
                        <a href={links.agentTel} className="underline-offset-2 hover:underline">
                          {attribution.listing_agent_phone}
                        </a>
                      ) : (
                        attribution.listing_agent_phone
                      )}
                    </>
                  ) : null}
                  {attribution.listing_agent_email ? (
                    <>
                      {" · "}
                      {links.agentMailto ? (
                        <a href={links.agentMailto} className="underline-offset-2 hover:underline">
                          {attribution.listing_agent_email}
                        </a>
                      ) : (
                        attribution.listing_agent_email
                      )}
                    </>
                  ) : null}
                  {links.agentWeb ? (
                    <>
                      {" · "}
                      <a
                        href={links.agentWeb}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        Website
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : (
            <p>
              Listing brokerage details were not included in the authorized MLS data for this
              property.
            </p>
          )}
          <p>MLS #{listing.mls_id}</p>
        </div>
      </div>
      <ListingStickyCta />
    </main>
  );
}

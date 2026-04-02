import Link from "next/link";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { formatPriceUsd } from "@/lib/format";
import { getPublishedListingBySlug } from "@/lib/listings-queries";
import { createMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const revalidate = 60;

type Props = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getPublishedListingBySlug(slug);
  if (!listing) {
    return createMetadata({
      title: "Listing not found",
      path: `/listings/${slug}`,
      noIndex: true,
    });
  }
  return createMetadata({
    title: listing.title,
    description:
      listing.description.length > 160
        ? `${listing.description.slice(0, 157)}…`
        : listing.description,
    path: `/listings/${listing.slug}`,
  });
}

export default async function ListingDetailPage({ params }: Props): Promise<ReactNode> {
  const { slug } = await params;
  const listing = await getPublishedListingBySlug(slug);
  if (!listing) {
    notFound();
  }

  const location = [listing.address_line, listing.city, listing.state, listing.postal_code]
    .filter(Boolean)
    .join(", ");

  return (
    <main id="main-content" className="min-h-screen bg-background px-6 pb-24 pt-28 sm:px-12 lg:px-24">
      <div className="mx-auto max-w-360 2xl:max-w-450 3xl:max-w-550">
        <Link
          href="/listings"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← All listings
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-muted">
              {listing.image_urls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.image_urls[0]}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Photos coming soon
                </div>
              )}
            </div>
            {listing.image_urls.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {listing.image_urls.slice(1, 9).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${url}-${i}`}
                    src={url}
                    alt=""
                    className="aspect-4/3 rounded-lg object-cover"
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              {listing.status === "sold" ? "Sold" : listing.status === "pending" ? "Pending" : "For sale"}
            </p>
            <h1 className="mt-2 text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              {listing.title}
            </h1>
            <p className="mt-4 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
              {formatPriceUsd(listing.price_cents)}
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              {listing.bedrooms} bed · {listing.bathrooms} bath
              {listing.square_feet ? ` · ${listing.square_feet.toLocaleString()} sq ft` : ""}
            </p>
            {location ? <p className="mt-2 text-muted-foreground">{location}</p> : null}

            <div className="mt-10 space-y-4">
              <Link
                href={`mailto:${siteConfig.email}?subject=${encodeURIComponent(`Inquiry: ${listing.title}`)}`}
                className="inline-flex w-full items-center justify-center rounded-full bg-foreground py-3.5 text-sm font-medium text-background hover:opacity-90 sm:w-auto sm:px-10"
              >
                Email {siteConfig.agentName}
              </Link>
              <Link
                href={`tel:${siteConfig.phoneTel}`}
                className="ml-0 inline-flex w-full items-center justify-center rounded-full border border-border py-3.5 text-sm font-medium hover:bg-muted/40 sm:ml-4 sm:w-auto sm:px-10"
              >
                Call {siteConfig.phoneDisplay}
              </Link>
            </div>

            <div className="mt-12 border-t border-border pt-10">
              <h2 className="text-lg font-medium text-foreground">About this home</h2>
              <p className="mt-4 whitespace-pre-line text-muted-foreground leading-relaxed">
                {listing.description || "More details available on request."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

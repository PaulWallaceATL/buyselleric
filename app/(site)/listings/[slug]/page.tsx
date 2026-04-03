import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingGallery } from "@/components/listing-gallery";
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

  const statusLabel =
    listing.status === "sold"
      ? "Sold"
      : listing.status === "pending"
        ? "Pending"
        : "For sale";

  return (
    <main id="main-content" className="min-h-screen bg-background pb-24 pt-24 sm:pt-28">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 lg:px-16">
        <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/listings" className="hover:text-foreground">
                Listings
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground">{listing.title}</li>
          </ol>
        </nav>

        <div className="mt-8">
          <ListingGallery urls={listing.image_urls} />
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-14">
          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-28 lg:space-y-8">
              <div>
                <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                  {statusLabel}
                </p>
                <h1 className="mt-2 text-3xl font-medium tracking-tight text-foreground sm:text-4xl lg:text-[2.25rem] lg:leading-tight">
                  {listing.title}
                </h1>
                <p className="mt-4 text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                  {formatPriceUsd(listing.price_cents)}
                </p>
                <p className="mt-4 text-lg text-muted-foreground">
                  {listing.bedrooms} bed · {listing.bathrooms} bath
                  {listing.square_feet ? ` · ${listing.square_feet.toLocaleString()} sq ft` : ""}
                </p>
                {location ? (
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">{location}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-col">
                <Link
                  href={`mailto:${siteConfig.email}?subject=${encodeURIComponent(`Inquiry: ${listing.title}`)}`}
                  className="inline-flex w-full items-center justify-center rounded-full bg-foreground py-3.5 text-sm font-medium text-background hover:opacity-90 sm:w-auto sm:min-w-[200px] lg:w-full"
                >
                  Email {siteConfig.agentName}
                </Link>
                <Link
                  href={`tel:${siteConfig.phoneTel}`}
                  className="inline-flex w-full items-center justify-center rounded-full border border-border py-3.5 text-sm font-medium hover:bg-muted/40 sm:w-auto sm:min-w-[200px] lg:w-full"
                >
                  Call {siteConfig.phoneDisplay}
                </Link>
                <a
                  href={siteConfig.mortgageApplicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-full border border-ring/50 bg-muted/30 py-3.5 text-sm font-medium text-foreground hover:border-ring hover:bg-muted/50 sm:w-auto sm:min-w-[200px] lg:w-full"
                >
                  Apply for financing
                </a>
              </div>

              <p className="hidden text-xs text-muted-foreground lg:block">
                Listing URL:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  /listings/{listing.slug}
                </code>
              </p>
            </div>
          </aside>

          <article className="lg:col-span-7">
            <h2 className="text-lg font-medium text-foreground">About this home</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
              {listing.description || "More details available on request."}
            </p>

            <div className="mt-12 border-t border-border pt-10">
              <Link
                href="/listings"
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                ← Back to all listings
              </Link>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingGallery } from "@/components/listing-gallery";
import { siteConfig } from "@/lib/config";
import { ctaMortgage, ctaPrimary, ctaSecondary } from "@/lib/cta-styles";
import { formatPriceUsd } from "@/lib/format";
import { filterDisplayImageUrls } from "@/lib/listing-urls";
import { getPublishedListingBySlug } from "@/lib/listings-queries";
import { stripHtmlLoose, truncateMetaDescription } from "@/lib/seo";
import { innerPageMainTopPadding, pageMain } from "@/lib/ui";
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
  const plain = stripHtmlLoose(listing.description || "");
  const summary = `${formatPriceUsd(listing.price_cents)} · ${listing.bedrooms} bd · ${listing.bathrooms} ba · ${listing.city}, ${listing.state}`;
  const description = truncateMetaDescription(plain.length >= 40 ? plain : `${listing.title}. ${summary}`);
  const images = filterDisplayImageUrls(listing.image_urls);
  return createMetadata({
    title: listing.title,
    description,
    path: `/listings/${listing.slug}`,
    ...(images[0] ? { image: images[0] } : {}),
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
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-12 lg:px-16">
        <nav className="text-sm text-muted-foreground sm:text-base" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <li>
              <Link href="/" className="rounded-sm hover:text-foreground focus-ring outline-none">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-muted-foreground/50">
              /
            </li>
            <li>
              <Link href="/listings" className="rounded-sm hover:text-foreground focus-ring outline-none">
                Listings
              </Link>
            </li>
            <li aria-hidden="true" className="text-muted-foreground/50">
              /
            </li>
            <li className="max-w-[min(100%,16rem)] truncate font-medium text-foreground sm:max-w-none sm:whitespace-normal">
              {listing.title}
            </li>
          </ol>
        </nav>

        <div className="mt-8">
          <ListingGallery urls={listing.image_urls} />
        </div>

        <div className="mt-8 grid gap-10 sm:mt-10 lg:grid-cols-12 lg:gap-14 lg:gap-y-12">
          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-28 lg:space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-sm">
                  {statusLabel}
                </p>
                <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.125rem] lg:leading-tight xl:text-[2.25rem]">
                  {listing.title}
                </h1>
                <p className="mt-4 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl lg:text-4xl">
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

              <div className="flex flex-col gap-4 lg:flex-col">
                <Link
                  href={`mailto:${siteConfig.email}?subject=${encodeURIComponent(`Inquiry: ${listing.title}`)}`}
                  className={`${ctaPrimary} lg:w-full`}
                >
                  Email {siteConfig.agentName}
                </Link>
                <Link href={`tel:${siteConfig.phoneTel}`} className={`${ctaSecondary} lg:w-full`}>
                  Call {siteConfig.phoneDisplay}
                </Link>
                <a
                  href={siteConfig.mortgageApplicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ctaMortgage} lg:w-full`}
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
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">About this home</h2>
            <p className="mt-4 whitespace-pre-line text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {listing.description || "More details available on request."}
            </p>

            <div className="mt-12 border-t border-border pt-10">
              <Link
                href="/listings"
                className="inline-flex min-h-12 items-center text-lg font-semibold text-foreground underline-offset-4 hover:underline"
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

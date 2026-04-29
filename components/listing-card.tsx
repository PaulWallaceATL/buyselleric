import Image from "next/image";
import Link from "next/link";
import { formatPriceUsd } from "@/lib/format";
import { listingImagePreferUnoptimized } from "@/lib/listing-urls";
import type { ListingRow } from "@/lib/types/db";

function pickImage(urls: string[]) {
  return urls[0] ?? null;
}

export function ListingCard({ listing }: { listing: ListingRow }) {
  const img = pickImage(listing.image_urls);
  const location = [listing.city, listing.state].filter(Boolean).join(", ");

  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="group block overflow-hidden rounded-2xl border border-border/90 bg-muted/20 shadow-sm transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:rounded-3xl"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted sm:aspect-4/3">
        {img ? (
          <Image
            src={img}
            alt={listing.title ?? ""}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            unoptimized={listingImagePreferUnoptimized(img)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-base text-muted-foreground">
            Photo coming soon
          </div>
        )}
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{listing.title}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
          {formatPriceUsd(listing.price_cents)}
        </p>
        <p className="mt-3 text-base text-muted-foreground">
          {listing.bedrooms} bd · {listing.bathrooms} ba
          {listing.square_feet ? ` · ${listing.square_feet.toLocaleString()} sq ft` : ""}
        </p>
        {location ? <p className="mt-1 text-base text-muted-foreground">{location}</p> : null}
        <p className="mt-4 text-base font-semibold text-ring underline-offset-4 group-hover:underline sm:mt-5 sm:text-lg">
          View full details →
        </p>
      </div>
    </Link>
  );
}

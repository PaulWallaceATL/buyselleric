import Link from "next/link";
import { formatPriceUsd } from "@/lib/format";
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
      className="group block overflow-hidden rounded-2xl border-2 border-border bg-muted/20 shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied listing URLs
          <img
            src={img}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-base text-muted-foreground">
            Photo coming soon
          </div>
        )}
      </div>
      <div className="p-6">
        <p className="text-xl font-semibold tracking-tight text-foreground">{listing.title}</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
          {formatPriceUsd(listing.price_cents)}
        </p>
        <p className="mt-3 text-base text-muted-foreground">
          {listing.bedrooms} bd · {listing.bathrooms} ba
          {listing.square_feet ? ` · ${listing.square_feet.toLocaleString()} sq ft` : ""}
        </p>
        {location ? <p className="mt-1 text-base text-muted-foreground">{location}</p> : null}
        <p className="mt-5 text-lg font-semibold text-ring underline-offset-4 group-hover:underline">
          View full details →
        </p>
      </div>
    </Link>
  );
}

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
      className="group block overflow-hidden rounded-2xl border border-border bg-muted/20 transition-shadow hover:shadow-lg"
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
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Photo coming soon
          </div>
        )}
      </div>
      <div className="p-5">
        <p className="text-lg font-medium tracking-tight text-foreground">{listing.title}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
          {formatPriceUsd(listing.price_cents)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {listing.bedrooms} bd · {listing.bathrooms} ba
          {listing.square_feet ? ` · ${listing.square_feet.toLocaleString()} sq ft` : ""}
        </p>
        {location ? <p className="mt-1 text-sm text-muted-foreground">{location}</p> : null}
      </div>
    </Link>
  );
}

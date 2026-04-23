"use client";

import dynamic from "next/dynamic";
import { listingDetailHref } from "@/lib/listing-urls";
import type { UnifiedListing } from "@/lib/listings-queries";

const ListingsMap = dynamic(() => import("@/components/listings-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-muted/10 sm:rounded-3xl" style={{ height: "min(70vh, 600px)" }}>
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  ),
});

export function ListingsMapView({ listings }: { listings: UnifiedListing[] }) {
  const pins = listings
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => ({
      id: l.id,
      title: l.title,
      lat: l.latitude!,
      lng: l.longitude!,
      price_cents: l.price_cents,
      href: listingDetailHref(l),
      city: l.city,
      state: l.state,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
    }));

  if (pins.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 p-10 text-center sm:rounded-3xl"
        style={{ height: "min(50vh, 400px)" }}
      >
        <div>
          <svg className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="font-medium text-foreground">Map view coming soon</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Coordinates will be available once the MLS integration is connected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border shadow-sm sm:rounded-3xl"
      style={{ height: "min(70vh, 600px)" }}
    >
      <ListingsMap pins={pins} />
    </div>
  );
}

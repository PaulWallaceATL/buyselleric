"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { listingDetailHref } from "@/lib/listing-urls";
import type { MapSearchCircle } from "@/components/listings-map";
import type { UnifiedListing } from "@/lib/listings-queries";

const ListingsMap = dynamic(() => import("@/components/listings-map"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full items-center justify-center rounded-2xl border border-border bg-muted/10 sm:rounded-3xl"
      style={{ height: "min(70vh, 600px)" }}
    >
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  ),
});

export function ListingsMapView({
  listings,
  baseParams,
  appliedCircle,
}: {
  listings: UnifiedListing[];
  baseParams: Record<string, string>;
  appliedCircle?: MapSearchCircle | null;
}) {
  const router = useRouter();
  const [drawActive, setDrawActive] = useState(false);

  const applyCircle = useCallback(
    (lat: number, lng: number, radiusM: number) => {
      const p = new URLSearchParams(baseParams);
      p.set("mapLat", String(lat));
      p.set("mapLng", String(lng));
      p.set("mapRadiusM", String(Math.round(radiusM)));
      p.delete("page");
      p.set("view", "map");
      setDrawActive(false);
      router.push(`/listings?${p.toString()}`);
    },
    [baseParams, router],
  );

  const clearCircle = useCallback(() => {
    const p = new URLSearchParams(baseParams);
    p.delete("mapLat");
    p.delete("mapLng");
    p.delete("mapRadiusM");
    p.delete("page");
    p.set("view", "map");
    setDrawActive(false);
    router.push(`/listings?${p.toString()}`);
  }, [baseParams, router]);

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
          <svg
            className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
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
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDrawActive((v) => !v)}
          className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            drawActive
              ? "bg-foreground text-background"
              : "border border-border text-foreground hover:bg-muted/30"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
          {drawActive ? "Cancel drawing" : "Draw search area"}
        </button>
        {appliedCircle && (
          <button
            type="button"
            onClick={clearCircle}
            className="inline-flex min-h-[40px] items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30"
          >
            Clear drawn area
          </button>
        )}
        {drawActive && (
          <p className="w-full text-sm text-muted-foreground sm:w-auto">
            Click the map for the center, then drag to size the circle. Release to search homes inside it.
          </p>
        )}
      </div>
      <div
        className="overflow-hidden rounded-2xl border border-border shadow-sm sm:rounded-3xl"
        style={{ height: "min(70vh, 600px)" }}
      >
        <ListingsMap
          pins={pins}
          appliedCircle={appliedCircle ?? null}
          drawActive={drawActive}
          onApplyCircle={applyCircle}
        />
      </div>
    </div>
  );
}

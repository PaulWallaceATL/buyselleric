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
  fallbackCenter,
}: {
  listings: UnifiedListing[];
  baseParams: Record<string, string>;
  appliedCircle?: MapSearchCircle | null;
  fallbackCenter: { lat: number; lng: number };
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

  const missingPins = listings.length > 0 && pins.length === 0;

  return (
    <div>
      {missingPins && (
        <p className="mb-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          These listings don&apos;t have map coordinates yet, so pins are hidden. The map is centered on your
          search — use <strong className="text-foreground">Draw search area</strong> to find homes inside a circle.
        </p>
      )}
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
          fallbackCenter={fallbackCenter}
          appliedCircle={appliedCircle ?? null}
          drawActive={drawActive}
          onApplyCircle={applyCircle}
        />
      </div>
    </div>
  );
}

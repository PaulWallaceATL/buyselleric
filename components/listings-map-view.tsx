"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { listingDetailHref } from "@/lib/listing-urls";
import { MAP_DRAW_VIEWPORT_STORAGE_KEY, writeDrawViewport } from "@/lib/listings-map-draw-storage";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";
import { encodeMapPolygonQuery, MAP_POLYGON_QUERY_KEY } from "@/lib/map-polygon-query";
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
  appliedPolygon,
  fallbackCenter,
  mapPolygonWideFetch,
}: {
  listings: UnifiedListing[];
  baseParams: Record<string, string>;
  appliedPolygon?: ReadonlyArray<MapPolygonVertex> | null;
  fallbackCenter: { lat: number; lng: number };
  mapPolygonWideFetch?: boolean | undefined;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapPolyFromUrl = searchParams.get(MAP_POLYGON_QUERY_KEY);
  const [mapNavPending, startMapNav] = useTransition();
  const [drawActive, setDrawActive] = useState(false);
  const [drawHint, setDrawHint] = useState<string | null>(null);
  const drawHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashDrawHint = useCallback((msg: string) => {
    if (drawHintTimer.current) clearTimeout(drawHintTimer.current);
    setDrawHint(msg);
    drawHintTimer.current = setTimeout(() => {
      setDrawHint(null);
      drawHintTimer.current = null;
    }, 6000);
  }, []);

  useEffect(
    () => () => {
      if (drawHintTimer.current) clearTimeout(drawHintTimer.current);
    },
    [],
  );

  const applyPolygon = useCallback(
    (ring: MapPolygonVertex[], view: { lat: number; lng: number; zoom: number }) => {
      const encoded = encodeMapPolygonQuery(ring);
      writeDrawViewport({
        mapPoly: encoded,
        lat: view.lat,
        lng: view.lng,
        zoom: view.zoom,
      });
      const p = new URLSearchParams(baseParams);
      p.set(MAP_POLYGON_QUERY_KEY, encoded);
      p.delete("page");
      p.set("view", "map");
      const href = `/listings?${p.toString()}`;
      startMapNav(() => {
        router.push(href, { scroll: false });
      });
      queueMicrotask(() => setDrawActive(false));
    },
    [baseParams, router],
  );

  const onStrokeRejected = useCallback(() => {
    flashDrawHint(
      "That outline was too small to search. Draw a slightly bigger closed loop with your finger or mouse, then release.",
    );
  }, [flashDrawHint]);

  const clearPolygon = useCallback(() => {
    const p = new URLSearchParams(baseParams);
    p.delete(MAP_POLYGON_QUERY_KEY);
    p.delete("page");
    p.set("view", "map");
    setDrawActive(false);
    const href = `/listings?${p.toString()}`;
    try {
      sessionStorage.removeItem(MAP_DRAW_VIEWPORT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    startMapNav(() => {
      router.push(href, { scroll: false });
    });
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
  const hasPoly = !!appliedPolygon && appliedPolygon.length >= 3;
  const zipApproxNoPins = hasPoly && !!mapPolygonWideFetch && missingPins;

  return (
    <div>
      {zipApproxNoPins && (
        <p className="mb-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Your outline is applied using <strong className="text-foreground">ZIP centroids</strong> (this MLS often
          omits coordinates on search). The list should follow your shape at ZIP-level accuracy;{" "}
          <strong className="text-foreground">map pins stay off</strong> when no coordinates are returned.
        </p>
      )}
      {missingPins && hasPoly && !zipApproxNoPins && (
        <p className="mb-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          These matches don&apos;t include coordinates in the feed response, so pins are hidden. Results still use
          your drawn area where we can place each listing (coordinates or ZIP).
        </p>
      )}
      {missingPins && !hasPoly && (
        <p className="mb-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          These listings don&apos;t have map coordinates yet, so pins are hidden. The map is centered on your
          search — use <strong className="text-foreground">Draw search area</strong> to outline a region.
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
        {appliedPolygon && appliedPolygon.length >= 3 && (
          <button
            type="button"
            onClick={clearPolygon}
            className="inline-flex min-h-[40px] items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30"
          >
            Clear drawn area
          </button>
        )}
        {drawActive && (
          <p className="w-full text-sm text-muted-foreground sm:w-auto">
            Hold the mouse button and trace a closed shape (like a crayon). Release to search inside the outline.
            Draw a loop big enough to cover a neighborhood (very tiny scribbles are ignored).
          </p>
        )}
        {drawHint && (
          <p className="w-full text-sm text-amber-700 dark:text-amber-400/90" role="status">
            {drawHint}
          </p>
        )}
      </div>
      <div
        className="relative overflow-hidden rounded-2xl border border-border shadow-sm sm:rounded-3xl"
        style={{ height: "min(70vh, 600px)" }}
      >
        <ListingsMap
          key={mapPolyFromUrl ?? "map-no-poly"}
          pins={pins}
          fallbackCenter={fallbackCenter}
          appliedPolygon={appliedPolygon ?? null}
          drawActive={drawActive}
          onApplyPolygon={applyPolygon}
          onStrokeRejected={onStrokeRejected}
          mapPolyFromUrl={mapPolyFromUrl}
        />
        {mapNavPending && (
          <div
            className="pointer-events-none absolute inset-0 z-[2000] flex flex-col items-center justify-center gap-3 bg-background/55 backdrop-blur-[2px]"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-foreground" />
            <p className="max-w-[min(280px,88vw)] text-center text-sm font-medium text-foreground">
              Updating listings for your drawn area…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

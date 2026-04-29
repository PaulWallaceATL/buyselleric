import Link from "next/link";
import { Suspense } from "react";
import { UnifiedListingCard } from "@/components/unified-listing-card";
import { ListingsFilters } from "@/components/listings-filters";
import { ListingsMapView } from "@/components/listings-map-view";
import { ListingsPagination } from "@/components/listings-pagination";
import { ListingsSearchBar } from "@/components/listings-search-bar";
import { siteConfig } from "@/lib/config";
import { ctaPrimary } from "@/lib/cta-styles";
import { mapFallbackCenterFromSearchQ } from "@/lib/listing-query-text";
import {
  decodeMapPolygonQuery,
  encodeMapPolygonQuery,
  MAP_POLYGON_QUERY_KEY,
} from "@/lib/map-polygon-query";
import { searchWithFilters, type ListingFilters } from "@/lib/listings-queries";
import { eyebrow, innerPageMainTopPadding, lead, pageMain, sectionTitle, siteContainer } from "@/lib/ui";
import { createMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Homes for sale",
  description: `Browse available homes with ${siteConfig.agentName}. Local expertise, clear guidance, and a smoother path to closing.`,
  path: "/listings",
});

function parseNum(val: string | string[] | undefined): number | undefined {
  if (typeof val !== "string") return undefined;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function mapPolyRaw(params: Record<string, string | string[] | undefined>): string | undefined {
  const v = params.mapPoly;
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const params = await searchParams;

  const decodedPoly = decodeMapPolygonQuery(mapPolyRaw(params));
  const mapPolygon =
    decodedPoly && decodedPoly.length >= 3 ? decodedPoly : undefined;
  const mapPolyEncoded = mapPolygon ? encodeMapPolygonQuery(mapPolygon) : undefined;

  const filters: ListingFilters = {
    q: typeof params.q === "string" ? params.q.trim() : undefined,
    minPrice: parseNum(params.minPrice),
    maxPrice: parseNum(params.maxPrice),
    minBeds: parseNum(params.minBeds),
    minBaths: parseNum(params.minBaths),
    minSqft: parseNum(params.minSqft),
    maxSqft: parseNum(params.maxSqft),
    propertyType: typeof params.propertyType === "string" ? params.propertyType : undefined,
    sort: (typeof params.sort === "string" ? params.sort : "price_desc") as ListingFilters["sort"],
    page: parseNum(params.page) ?? 1,
    perPage: 24,
    mapPolygon,
  };

  const view = typeof params.view === "string" ? params.view : "list";
  const { listings, total, page, totalPages } = await searchWithFilters(filters);

  const baseParams: Record<string, string> = {};
  if (filters.q) baseParams.q = filters.q;
  if (filters.minPrice) baseParams.minPrice = String(filters.minPrice);
  if (filters.maxPrice) baseParams.maxPrice = String(filters.maxPrice);
  if (filters.minBeds) baseParams.minBeds = String(filters.minBeds);
  if (filters.minBaths) baseParams.minBaths = String(filters.minBaths);
  if (filters.minSqft) baseParams.minSqft = String(filters.minSqft);
  if (filters.maxSqft) baseParams.maxSqft = String(filters.maxSqft);
  if (filters.sort && filters.sort !== "price_desc") baseParams.sort = filters.sort;
  if (view !== "list") baseParams.view = view;
  if (mapPolyEncoded) baseParams[MAP_POLYGON_QUERY_KEY] = mapPolyEncoded;

  const hasFilters = !!(
    filters.q ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minBeds ||
    filters.minBaths ||
    filters.minSqft ||
    filters.maxSqft ||
    (mapPolygon && mapPolygon.length >= 3)
  );

  const appliedMapPolygon =
    mapPolygon && mapPolygon.length >= 3 ? mapPolygon : null;

  const mapFallbackCenter = mapFallbackCenterFromSearchQ(filters.q);

  return (
    <main id="main-content" className={pageMain} style={innerPageMainTopPadding}>
      <div className={siteContainer}>
        <p className={eyebrow}>{siteConfig.brandSlug}</p>
        <h1 className={`${sectionTitle} mt-3`}>
          {hasFilters ? "Search results" : "Available homes"}
        </h1>
        <p className={`${lead} mt-4`}>
          {appliedMapPolygon
            ? "Showing homes with coordinates inside your drawn map outline (plus any other filters you set)."
            : filters.q
              ? `Showing homes matching "${filters.q}"`
              : "Browse homes across Georgia. Use filters to narrow your search."}
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <ListingsSearchBar defaultValue={filters.q ?? ""} />
            <ViewToggle baseParams={baseParams} activeView={view} />
          </div>
          <Suspense>
            <ListingsFilters />
          </Suspense>
        </div>

        {view === "map" ? (
          <div className="mt-8">
            <ListingsMapView
              listings={listings}
              baseParams={baseParams}
              appliedPolygon={appliedMapPolygon}
              fallbackCenter={mapFallbackCenter}
            />
            {listings.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/15 px-5 py-8 text-center sm:px-8">
                <p className="font-medium text-foreground">No homes in this view</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {appliedMapPolygon
                    ? "Nothing with map coordinates fell inside that outline. Try a larger shape, use Clear drawn area above the map, or loosen your filters. Listings without coordinates never match map outlines."
                    : hasFilters
                      ? "Try adjusting filters or switch to list view."
                      : "Try adjusting your search."}
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((l) => (
                  <UnifiedListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState hasFilters={hasFilters} query={filters.q} />
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <UnifiedListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}

        <ListingsPagination
          page={page}
          totalPages={totalPages}
          total={total}
          baseParams={baseParams}
        />
      </div>
    </main>
  );
}

function ViewToggle({ baseParams, activeView }: { baseParams: Record<string, string>; activeView: string }) {
  function buildHref(v: string) {
    const p = new URLSearchParams(baseParams);
    if (v !== "list") p.set("view", v); else p.delete("view");
    p.delete("page");
    const qs = p.toString();
    return `/listings${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href={buildHref("list")}
        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          activeView !== "map"
            ? "bg-foreground text-background"
            : "border border-border text-foreground hover:bg-muted/30"
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        List
      </Link>
      <Link
        href={buildHref("map")}
        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          activeView === "map"
            ? "bg-foreground text-background"
            : "border border-border text-foreground hover:bg-muted/30"
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        Map
      </Link>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean; query?: string | undefined }) {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-border bg-muted/20 p-10 text-center sm:mt-12 sm:p-12">
      <p className="font-medium text-foreground">
        {hasFilters ? "No homes match your filters" : "No published listings yet."}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasFilters
          ? "Try adjusting your price range, bedrooms, or search term."
          : "Check back soon—or tell Eric what you are looking for."}
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {hasFilters && (
          <Link href="/listings" className={ctaPrimary}>
            Clear all filters
          </Link>
        )}
        <Link
          href="/sell"
          className={hasFilters ? "text-sm font-medium text-ring underline underline-offset-4" : ctaPrimary}
        >
          Start a seller conversation
        </Link>
      </div>
    </div>
  );
}

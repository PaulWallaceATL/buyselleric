import {
  bridgeFetchTopUnifiedListings,
  bridgeFetchUnifiedPage,
  bridgeGetMlsListingById,
  bridgeSearchWithFilters,
  isBridgeListingsEnabled,
} from "@/lib/bridge-listings";
import {
  isSparkListingsEnabled,
  sparkFetchTopUnifiedListings,
  sparkFetchUnifiedPage,
  sparkGetMlsListingById,
  sparkSearchWithFilters,
} from "@/lib/spark-listings";
import { enrichListingsWithPhotonGeocode } from "@/lib/geocode-listing-address";
import { applyZipCentroidPinCoords } from "@/lib/map-pin-coords";
import { pointInPolygon } from "@/lib/geo";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";
import { parseCityStateSearchQuery } from "@/lib/listing-query-text";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ListingRow, MlsListingRow } from "@/lib/types/db";
import { unstable_noStore as noStore } from "next/cache";

/**
 * Live MLS feeds we currently merge from. `manual` covers Eric's hand-curated
 * Supabase listings; `bridge` is Bridge Interactive (gamls2 IDX); `spark` is
 * the Spark Platform RESO Web API (Middle Georgia MLS).
 */
export type ListingFeed = "manual" | "bridge" | "spark";

export interface UnifiedListing {
  id: string;
  slug: string | null;
  mls_id: string | null;
  title: string;
  address_line: string;
  city: string;
  state: string;
  postal_code: string;
  price_cents: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number | null;
  latitude: number | null;
  longitude: number | null;
  image_urls: string[];
  source: "manual" | "mls";
  /** Which upstream feed produced the row — drives the per-card source badge. */
  feed?: ListingFeed;
  listing_agent?: string;
  listing_office?: string;
}

export interface ListingFilters {
  q?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  minBeds?: number | undefined;
  minBaths?: number | undefined;
  minSqft?: number | undefined;
  maxSqft?: number | undefined;
  propertyType?: string | undefined;
  sort?: "price_asc" | "price_desc" | "newest" | "sqft_desc" | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
  /** Map draw: closed or open ring (≥3 vertices); listings must fall inside polygon. */
  mapPolygon?: ReadonlyArray<MapPolygonVertex> | undefined;
}

export interface PaginatedResult {
  listings: UnifiedListing[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  /** Bridge: OData bbox returned nothing (often null coords in MLS); we widened to text filters + ZIP-centroid match inside the draw. */
  mapPolygonWideFetch?: boolean | undefined;
}

function manualToUnified(l: ListingRow): UnifiedListing {
  return {
    id: l.id, slug: l.slug, mls_id: null, title: l.title,
    address_line: l.address_line, city: l.city, state: l.state,
    postal_code: l.postal_code, price_cents: l.price_cents,
    bedrooms: l.bedrooms, bathrooms: l.bathrooms,
    square_feet: l.square_feet, latitude: l.latitude,
    longitude: l.longitude, image_urls: l.image_urls, source: "manual",
    feed: "manual",
  };
}

function mlsToUnified(m: MlsListingRow): UnifiedListing {
  return {
    id: m.id, slug: null, mls_id: m.mls_id,
    title: m.title || `${m.address_line}, ${m.city}`,
    address_line: m.address_line, city: m.city, state: m.state,
    postal_code: m.postal_code, price_cents: m.price_cents,
    bedrooms: m.bedrooms, bathrooms: m.bathrooms,
    square_feet: m.square_feet, latitude: m.latitude,
    longitude: m.longitude, image_urls: m.image_urls, source: "mls",
    listing_agent: m.listing_agent, listing_office: m.listing_office,
  };
}

/**
 * Polygon-merge cap (only applies when a drawn outline is active). Without a
 * polygon, we use deep per-feed offset pagination so all results are
 * navigable; the polygon path needs to fetch the full candidate set so we
 * can apply point-in-polygon in memory.
 */
const POLYGON_MAX_ROWS_PER_FEED = Math.min(
  4_000,
  Math.max(48, Number.parseInt(process.env.MULTI_FEED_MERGE_MAX_ROWS?.trim() ?? "1500", 10) || 1500),
);

/**
 * Map view pulls more rows per feed so cluster pins reflect the full result set.
 * Parallel paginated OData fetches keep this fast even at high caps.
 */
const MAP_PINS_MAX_ROWS_PER_FEED = Math.min(
  4_000,
  Math.max(100, Number.parseInt(process.env.MAP_PINS_MAX_ROWS_PER_FEED?.trim() ?? "1500", 10) || 1500),
);

function unifiedSorter(sort: ListingFilters["sort"]) {
  return (a: UnifiedListing, b: UnifiedListing): number => {
    switch (sort) {
      case "price_asc":
        return a.price_cents - b.price_cents;
      case "sqft_desc":
        return (b.square_feet ?? 0) - (a.square_feet ?? 0);
      case "newest":
        // Manual listings first, then MLS — preserves prior behaviour for newest.
        return (a.source === "manual" ? -1 : 1) - (b.source === "manual" ? -1 : 1);
      case "price_desc":
      default:
        return b.price_cents - a.price_cents;
    }
  };
}

function dedupeUnifiedListings(rows: UnifiedListing[]): UnifiedListing[] {
  const seen = new Set<string>();
  const out: UnifiedListing[] = [];
  for (const r of rows) {
    const key = r.id || r.mls_id || `${r.address_line}|${r.city}|${r.postal_code}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Polygon-aware multi-feed merge. We fetch a wider window from each feed,
 * apply in-memory point-in-polygon, then paginate. This path keeps the cap
 * (POLYGON_MAX_ROWS_PER_FEED) because we can't push the polygon down into
 * OData — the bbox is the closest server-side filter.
 */
async function searchWithMultipleFeedsPolygon(
  filters: ListingFilters,
  poly: ReadonlyArray<MapPolygonVertex>,
): Promise<PaginatedResult> {
  const requestedPage = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 24));

  const tasks: Array<Promise<{ rows: UnifiedListing[]; total: number }>> = [];
  if (isBridgeListingsEnabled()) {
    tasks.push(bridgeFetchTopUnifiedListings(filters, POLYGON_MAX_ROWS_PER_FEED));
  }
  if (isSparkListingsEnabled()) {
    tasks.push(sparkFetchTopUnifiedListings(filters, POLYGON_MAX_ROWS_PER_FEED));
  }

  const settled = await Promise.allSettled(tasks);
  const allRows: UnifiedListing[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") allRows.push(...s.value.rows);
    else console.warn("searchWithMultipleFeedsPolygon: feed failed", s.reason);
  }

  let unified = dedupeUnifiedListings(allRows).filter((u) => {
    if (u.latitude == null || u.longitude == null) return true;
    return pointInPolygon(u.latitude, u.longitude, poly);
  });
  unified.sort(unifiedSorter(filters.sort));

  const total = unified.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
  const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const start = (page - 1) * perPage;
  let listings = unified.slice(start, start + perPage);
  listings = applyZipCentroidPinCoords(listings, poly);
  listings = await enrichListingsWithPhotonGeocode(listings, { polygon: poly });

  return { listings, total, page, perPage, totalPages };
}

/**
 * Deep multi-feed pagination using feed-sequential routing.
 *
 * Pages 1..ceil(bridgeTotal/perPage) come from Bridge in Bridge's own sort;
 * the remaining pages come from Spark in Spark's own sort. This guarantees
 * every listing across both feeds is reachable via the page nav (a 5k-row
 * search yields 5k browsable rows) and each page is always full unless it
 * lands on the very last partial page of the second feed.
 *
 * Trade-off: cross-feed price interleaving is sacrificed at the seam between
 * Bridge's last page and Spark's first page. The previous "fetch the same
 * $skip from both feeds in parallel and in-memory sort" approach preserved
 * interleaving for early pages but produced empty pages once one feed ran
 * out of rows (very common in the Bridge ~5k vs. Spark ~1k case here), so
 * deep pagination effectively topped out. Sequential routing is the simpler
 * trade and matches how IDX-style sites typically merge regional MLS feeds.
 *
 * Latency: one parallel round trip in the common (early/Bridge) case, plus
 * a second sequential trip when the page lands in Spark territory. The
 * speculative Bridge fetch doubles as the data fetch; the Spark probe is a
 * `$top=1, $count=true` "just give me the total" call.
 */
async function searchWithMultipleFeeds(filters: ListingFilters): Promise<PaginatedResult> {
  const poly = filters.mapPolygon;
  if (poly && poly.length >= 3) return searchWithMultipleFeedsPolygon(filters, poly);

  const requestedPage = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 24));

  const bridgeOn = isBridgeListingsEnabled();
  const sparkOn = isSparkListingsEnabled();

  if (!bridgeOn && !sparkOn) {
    return { listings: [], total: 0, page: 1, perPage, totalPages: 0 };
  }

  // Three parallel probes:
  //   1. Bridge count: cheap `$top=1` purely to read `@odata.count`.
  //      Decoupled from the data fetch so a transient data-page failure
  //      (timeout, deep-skip 5xx, etc.) doesn't collapse `totalPages`.
  //   2. Bridge data at the requested skip — speculative; if the page lands
  //      in Bridge (common case) we already have the rows after one round
  //      trip.
  //   3. Spark count: same cheap `$top=1` probe.
  const speculativeBridgeSkip = (requestedPage - 1) * perPage;
  const [bridgeCountRes, bridgeRes, sparkProbeRes] = await Promise.allSettled([
    bridgeOn
      ? bridgeFetchUnifiedPage(filters, { skip: 0, take: 1 })
      : Promise.resolve<{ rows: UnifiedListing[]; total: number }>({ rows: [], total: 0 }),
    bridgeOn
      ? bridgeFetchUnifiedPage(filters, { skip: speculativeBridgeSkip, take: perPage })
      : Promise.resolve<{ rows: UnifiedListing[]; total: number }>({ rows: [], total: 0 }),
    sparkOn
      ? sparkFetchUnifiedPage(filters, { skip: 0, take: 1 })
      : Promise.resolve<{ rows: UnifiedListing[]; total: number }>({ rows: [], total: 0 }),
  ]);

  if (bridgeCountRes.status === "rejected") {
    console.warn("searchWithMultipleFeeds: bridge count probe failed", bridgeCountRes.reason);
  }
  if (bridgeRes.status === "rejected") {
    console.warn("searchWithMultipleFeeds: bridge probe failed", bridgeRes.reason);
  }
  if (sparkProbeRes.status === "rejected") {
    console.warn("searchWithMultipleFeeds: spark probe failed", sparkProbeRes.reason);
  }

  // Totals come ONLY from the skip=0 count probes. The speculative data fetch
  // runs at (page-1)*perPage; when @odata.count is absent its fallback total is
  // skip+rows (e.g. 33 on page 2) — never use that for pagination math.
  let bridgeTotal =
    bridgeCountRes.status === "fulfilled" ? bridgeCountRes.value.total : 0;
  if (bridgeTotal === 0 && bridgeOn) {
    const retry = await bridgeFetchUnifiedPage(filters, { skip: 0, take: 1 });
    bridgeTotal = retry.total;
  }
  const sparkTotal = sparkProbeRes.status === "fulfilled" ? sparkProbeRes.value.total : 0;

  const bridgePages = bridgeTotal > 0 ? Math.ceil(bridgeTotal / perPage) : 0;
  const sparkPages = sparkTotal > 0 ? Math.ceil(sparkTotal / perPage) : 0;
  const totalPages = bridgePages + sparkPages;
  const total = bridgeTotal + sparkTotal;

  if (totalPages === 0) {
    return { listings: [], total: 0, page: 1, perPage, totalPages: 0 };
  }

  const safePage = Math.min(requestedPage, totalPages);

  let rows: UnifiedListing[] = [];
  if (safePage <= bridgePages) {
    const globalOffset = (safePage - 1) * perPage;
    const haveSpeculativeRows =
      safePage === requestedPage &&
      bridgeRes.status === "fulfilled" &&
      bridgeRes.value.rows.length > 0;
    if (haveSpeculativeRows) {
      rows = (bridgeRes as PromiseFulfilledResult<{ rows: UnifiedListing[]; total: number }>).value.rows;
    } else {
      // Either the page was clamped (requested > totalPages) or the speculative
      // bridge data probe failed/returned empty (the parallel count probe still
      // gave us a real total, so the page IS supposed to have rows). Refetch
      // sequentially — a fresh request without the parallel count probe in
      // flight tends to succeed when the parallel pair didn't.
      let res = await bridgeFetchUnifiedPage(filters, { skip: globalOffset, take: perPage });
      if (res.rows.length === 0) {
        res = await bridgeFetchUnifiedPage(filters, { skip: globalOffset, take: perPage });
      }
      rows = res.rows;
    }

    // Bridge count can overstate depth or deep $skip can flake — if we're still
    // empty inside Bridge territory, serve the Spark slice for this global offset.
    if (rows.length === 0 && sparkOn && sparkTotal > 0) {
      const effectiveBridgeRows =
        bridgeTotal > 0 && bridgeTotal <= globalOffset ? bridgeTotal : globalOffset;
      const sparkSkip = Math.max(0, globalOffset - effectiveBridgeRows);
      const sparkRes = await sparkFetchUnifiedPage(filters, { skip: sparkSkip, take: perPage });
      rows = sparkRes.rows;
    }
  } else {
    // Past Bridge → land in Spark. Re-base the page index against Spark's range.
    const sparkPageIndex = safePage - bridgePages;
    const skip = Math.max(0, (sparkPageIndex - 1) * perPage);
    const res = await sparkFetchUnifiedPage(filters, { skip, take: perPage });
    rows = res.rows;
  }

  let listings = dedupeUnifiedListings(rows);
  listings = applyZipCentroidPinCoords(listings, undefined);
  listings = await enrichListingsWithPhotonGeocode(listings);

  return { listings, total, page: safePage, perPage, totalPages };
}

/**
 * Fetch enough rows across all enabled feeds to drive the map cluster layer
 * (Zillow-style "every result has a pin"). Caller may render thousands of
 * pins via leaflet.markercluster, but we still cap per-feed to keep the
 * function within Vercel time limits on broad queries.
 */
export async function fetchAllPinsForMap(filters: ListingFilters): Promise<UnifiedListing[]> {
  const bridgeOn = isBridgeListingsEnabled();
  const sparkOn = isSparkListingsEnabled();

  // Manual listings live in Supabase; gather them too so curated rows show
  // a pin alongside MLS results.
  const supabase = await createSupabaseServerClient();
  const manualPromise: Promise<UnifiedListing[]> = supabase
    ? (async () => {
        const r = await supabase.from("listings").select("*").eq("is_published", true).limit(500);
        const rows = ((r.data ?? []) as ListingRow[]).map(manualToUnified);
        return filterManualByListingFilters(rows, filters);
      })()
    : Promise.resolve<UnifiedListing[]>([]);

  const tasks: Array<Promise<UnifiedListing[]>> = [manualPromise];
  if (bridgeOn) {
    tasks.push(
      bridgeFetchTopUnifiedListings(filters, MAP_PINS_MAX_ROWS_PER_FEED).then((r) => r.rows),
    );
  }
  if (sparkOn) {
    tasks.push(
      sparkFetchTopUnifiedListings(filters, MAP_PINS_MAX_ROWS_PER_FEED).then((r) => r.rows),
    );
  }

  const settled = await Promise.allSettled(tasks);
  const all: UnifiedListing[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") all.push(...s.value);
    else console.warn("fetchAllPinsForMap: feed failed", s.reason);
  }

  let rows = dedupeUnifiedListings(all);
  rows = applyZipCentroidPinCoords(rows, filters.mapPolygon);
  rows = await enrichListingsWithPhotonGeocode(rows, filters.mapPolygon ? { polygon: filters.mapPolygon } : undefined);

  // Polygon-aware drop: only keep rows that fall inside the drawn outline
  // (when present); leave open-search results untouched.
  const poly = filters.mapPolygon;
  if (poly && poly.length >= 3) {
    rows = rows.filter((r) => {
      if (r.latitude == null || r.longitude == null) return false;
      return pointInPolygon(r.latitude, r.longitude, poly);
    });
  }

  // Keep only rows we can pin on the map.
  return rows.filter((r) => r.latitude != null && r.longitude != null);
}

/** Apply scalar listing filters to the manual Supabase rows. Polygon is handled in the caller. */
function filterManualByListingFilters(rows: UnifiedListing[], filters: ListingFilters): UnifiedListing[] {
  const minPriceCents = filters.minPrice ? filters.minPrice * 100 : undefined;
  const maxPriceCents = filters.maxPrice ? filters.maxPrice * 100 : undefined;
  return rows.filter((r) => {
    if (minPriceCents != null && r.price_cents < minPriceCents) return false;
    if (maxPriceCents != null && r.price_cents > maxPriceCents) return false;
    if (filters.minBeds != null && r.bedrooms < filters.minBeds) return false;
    if (filters.minBaths != null && r.bathrooms < filters.minBaths) return false;
    if (filters.minSqft != null && (r.square_feet ?? 0) < filters.minSqft) return false;
    if (filters.maxSqft != null && (r.square_feet ?? Number.POSITIVE_INFINITY) > filters.maxSqft) return false;
    return true;
  });
}

export async function searchWithFilters(filters: ListingFilters): Promise<PaginatedResult> {
  noStore();
  const bridgeOn = isBridgeListingsEnabled();
  const sparkOn = isSparkListingsEnabled();

  if (bridgeOn && sparkOn) {
    return searchWithMultipleFeeds(filters);
  }
  if (bridgeOn) {
    return bridgeSearchWithFilters(filters);
  }
  if (sparkOn) {
    return sparkSearchWithFilters(filters);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { listings: [], total: 0, page: 1, perPage: 24, totalPages: 0 };

  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 24));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const allListings: UnifiedListing[] = [];

  // Query manual listings
  let manualQuery = supabase.from("listings").select("*");
  if (filters.q) {
    const trimmed = filters.q.trim();
    const cityState = parseCityStateSearchQuery(trimmed);
    if (cityState) {
      manualQuery = manualQuery.ilike("city", `%${cityState.city}%`).ilike("state", `%${cityState.state}%`);
    } else {
      const term = `%${trimmed}%`;
      manualQuery = manualQuery.or(
        `address_line.ilike.${term},city.ilike.${term},state.ilike.${term},postal_code.ilike.${term},title.ilike.${term}`,
      );
    }
  }
  if (filters.minPrice) manualQuery = manualQuery.gte("price_cents", filters.minPrice * 100);
  if (filters.maxPrice) manualQuery = manualQuery.lte("price_cents", filters.maxPrice * 100);
  if (filters.minBeds) manualQuery = manualQuery.gte("bedrooms", filters.minBeds);
  if (filters.minBaths) manualQuery = manualQuery.gte("bathrooms", filters.minBaths);
  if (filters.minSqft) manualQuery = manualQuery.gte("square_feet", filters.minSqft);
  if (filters.maxSqft) manualQuery = manualQuery.lte("square_feet", filters.maxSqft);

  const manualResult = await manualQuery;
  const manual = ((manualResult.data ?? []) as ListingRow[]).map(manualToUnified);
  allListings.push(...manual);

  // Query MLS listings
  let mlsQuery = supabase.from("mls_listings").select("*").eq("status", "active");
  if (filters.q) {
    const trimmed = filters.q.trim();
    const cityState = parseCityStateSearchQuery(trimmed);
    if (cityState) {
      mlsQuery = mlsQuery.ilike("city", `%${cityState.city}%`).ilike("state", `%${cityState.state}%`);
    } else {
      const term = `%${trimmed}%`;
      mlsQuery = mlsQuery.or(
        `address_line.ilike.${term},city.ilike.${term},state.ilike.${term},postal_code.ilike.${term},title.ilike.${term}`,
      );
    }
  }
  if (filters.minPrice) mlsQuery = mlsQuery.gte("price_cents", filters.minPrice * 100);
  if (filters.maxPrice) mlsQuery = mlsQuery.lte("price_cents", filters.maxPrice * 100);
  if (filters.minBeds) mlsQuery = mlsQuery.gte("bedrooms", filters.minBeds);
  if (filters.minBaths) mlsQuery = mlsQuery.gte("bathrooms", filters.minBaths);
  if (filters.minSqft) mlsQuery = mlsQuery.gte("square_feet", filters.minSqft);
  if (filters.maxSqft) mlsQuery = mlsQuery.lte("square_feet", filters.maxSqft);
  if (filters.propertyType) mlsQuery = mlsQuery.ilike("property_type", `%${filters.propertyType}%`);

  const mlsResult = await mlsQuery.limit(5000);
  const mls = ((mlsResult.data ?? []) as MlsListingRow[]).map(mlsToUnified);
  allListings.push(...mls);

  const poly = filters.mapPolygon;
  if (poly && poly.length >= 3) {
    const filtered = allListings.filter((l) => {
      if (l.latitude == null || l.longitude == null) return false;
      return pointInPolygon(l.latitude, l.longitude, poly);
    });
    allListings.length = 0;
    allListings.push(...filtered);
  }

  // Sort
  const sort = filters.sort ?? "price_desc";
  allListings.sort((a, b) => {
    switch (sort) {
      case "price_asc": return a.price_cents - b.price_cents;
      case "price_desc": return b.price_cents - a.price_cents;
      case "sqft_desc": return (b.square_feet ?? 0) - (a.square_feet ?? 0);
      case "newest": return 0;
      default: return b.price_cents - a.price_cents;
    }
  });
  // Manual listings always first when no explicit sort
  if (sort === "newest") {
    allListings.sort((a, b) => (a.source === "manual" ? -1 : 1) - (b.source === "manual" ? -1 : 1));
  }

  const total = allListings.length;
  const totalPages = Math.ceil(total / perPage);
  const paginated = allListings.slice(from, to + 1);

  return { listings: paginated, total, page, perPage, totalPages };
}

export async function getPublishedListings(): Promise<ListingRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
  if (error) { console.error("getPublishedListings", error.message); return []; }
  return (data ?? []) as ListingRow[];
}

export async function getPublishedListingBySlug(slug: string): Promise<ListingRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("listings").select("*").eq("slug", slug).maybeSingle();
  if (error) { console.error("getPublishedListingBySlug", error.message); return null; }
  return data as ListingRow | null;
}

export async function getMlsListingById(mlsId: string): Promise<MlsListingRow | null> {
  // Try live feeds in parallel — first non-null wins. Order is deterministic
  // (Bridge before Spark) so that overlapping listings have a consistent
  // canonical source for SEO/JSON-LD.
  const liveLookups: Array<Promise<MlsListingRow | null>> = [];
  if (isBridgeListingsEnabled()) liveLookups.push(bridgeGetMlsListingById(mlsId));
  if (isSparkListingsEnabled()) liveLookups.push(sparkGetMlsListingById(mlsId));
  if (liveLookups.length > 0) {
    const results = await Promise.allSettled(liveLookups);
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) return r.value;
    }
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const client = createSupabaseAdminClient();
  if (!client) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase.from("mls_listings").select("*").eq("mls_id", mlsId).maybeSingle();
    return data as MlsListingRow | null;
  }
  const { data, error } = await client.from("mls_listings").select("*").eq("mls_id", mlsId).maybeSingle();
  if (error) { console.error("getMlsListingById", error.message); return null; }
  return data as MlsListingRow | null;
}

import { cache } from "react";
import {
  bridgeFetchTopUnifiedListings,
  bridgeFetchUnifiedPage,
  bridgeGetMlsListingById,
  bridgeProbeExactTotal,
  bridgeSearchWithFilters,
  isBridgeListingsEnabled,
} from "@/lib/bridge-listings";
import {
  isSparkListingsEnabled,
  sparkFetchTopUnifiedListings,
  sparkFetchUnifiedPage,
  sparkGetMlsListingById,
  sparkProbeExactTotal,
  sparkSearchWithFilters,
} from "@/lib/spark-listings";
import { enrichListingsWithPhotonGeocode } from "@/lib/geocode-listing-address";
import { applyZipCentroidPinCoords } from "@/lib/map-pin-coords";
import { pointInPolygon } from "@/lib/geo";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";
import { parseCityStateSearchQuery } from "@/lib/listing-query-text";
import {
  hasMlsAttribution,
  mergeMlsListingRows,
  scoreMlsListingCompleteness,
} from "@/lib/mls-attribution";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ListingRow, MlsListingRow } from "@/lib/types/db";

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
  listing_agent_phone?: string;
  listing_office?: string;
  listing_office_phone?: string;
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

function mlsToUnified(m: MlsListingRow, feed: ListingFeed = "bridge"): UnifiedListing {
  return {
    id: m.id, slug: null, mls_id: m.mls_id,
    title: m.title || `${m.address_line}, ${m.city}`,
    address_line: m.address_line, city: m.city, state: m.state,
    postal_code: m.postal_code, price_cents: m.price_cents,
    bedrooms: m.bedrooms, bathrooms: m.bathrooms,
    square_feet: m.square_feet, latitude: m.latitude,
    longitude: m.longitude, image_urls: m.image_urls, source: "mls",
    feed,
    listing_agent: m.listing_agent,
    listing_agent_phone: m.listing_agent_phone,
    listing_office: m.listing_office,
    listing_office_phone: m.listing_office_phone,
  };
}

/** GAMLS rows synced via RETS — used when Bridge live OData is rate-limited (429). */
async function countGamlsListingsFromSupabase(filters: ListingFilters): Promise<number> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return 0;

  let q = supabase.from("mls_listings").select("*", { count: "exact", head: true }).eq("status", "active");

  if (filters.q) {
    const trimmed = filters.q.trim();
    const cityState = parseCityStateSearchQuery(trimmed);
    if (cityState) {
      q = q.ilike("city", `%${cityState.city}%`).ilike("state", `%${cityState.state}%`);
    } else {
      const term = `%${trimmed}%`;
      q = q.or(
        `address_line.ilike.${term},city.ilike.${term},state.ilike.${term},postal_code.ilike.${term},title.ilike.${term}`,
      );
    }
  }
  if (filters.minPrice) q = q.gte("price_cents", filters.minPrice * 100);
  if (filters.maxPrice) q = q.lte("price_cents", filters.maxPrice * 100);
  if (filters.minBeds) q = q.gte("bedrooms", filters.minBeds);
  if (filters.minBaths) q = q.gte("bathrooms", filters.minBaths);
  if (filters.minSqft) q = q.gte("square_feet", filters.minSqft);
  if (filters.maxSqft) q = q.lte("square_feet", filters.maxSqft);
  if (filters.propertyType) q = q.ilike("property_type", `%${filters.propertyType}%`);

  const { count, error } = await q;
  if (error) {
    console.warn("countGamlsListingsFromSupabase", error.message);
    return 0;
  }
  return count ?? 0;
}

async function fetchGamlsListingsFromSupabase(
  filters: ListingFilters,
  opts: { skip: number; take: number },
): Promise<{ rows: UnifiedListing[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { rows: [], total: 0 };

  const take = Math.max(1, opts.take);
  let q = supabase.from("mls_listings").select("*", { count: "exact" }).eq("status", "active");

  if (filters.q) {
    const trimmed = filters.q.trim();
    const cityState = parseCityStateSearchQuery(trimmed);
    if (cityState) {
      q = q.ilike("city", `%${cityState.city}%`).ilike("state", `%${cityState.state}%`);
    } else {
      const term = `%${trimmed}%`;
      q = q.or(
        `address_line.ilike.${term},city.ilike.${term},state.ilike.${term},postal_code.ilike.${term},title.ilike.${term}`,
      );
    }
  }
  if (filters.minPrice) q = q.gte("price_cents", filters.minPrice * 100);
  if (filters.maxPrice) q = q.lte("price_cents", filters.maxPrice * 100);
  if (filters.minBeds) q = q.gte("bedrooms", filters.minBeds);
  if (filters.minBaths) q = q.gte("bathrooms", filters.minBaths);
  if (filters.minSqft) q = q.gte("square_feet", filters.minSqft);
  if (filters.maxSqft) q = q.lte("square_feet", filters.maxSqft);
  if (filters.propertyType) q = q.ilike("property_type", `%${filters.propertyType}%`);

  switch (filters.sort) {
    case "price_asc":
      q = q.order("price_cents", { ascending: true });
      break;
    case "sqft_desc":
      q = q.order("square_feet", { ascending: false, nullsFirst: false });
      break;
    case "newest":
      q = q.order("synced_at", { ascending: false });
      break;
    case "price_desc":
    default:
      q = q.order("price_cents", { ascending: false });
      break;
  }

  const { data, count, error } = await q.range(opts.skip, opts.skip + take - 1);

  if (error) {
    console.warn("fetchGamlsListingsFromSupabase", error.message);
    return { rows: [], total: 0 };
  }

  const rows = ((data ?? []) as MlsListingRow[]).map((m) => mlsToUnified(m, "bridge"));
  return { rows, total: count ?? rows.length };
}

async function resolveBridgeTotal(
  filters: ListingFilters,
  bridgeOn: boolean,
): Promise<number> {
  if (!bridgeOn) return 0;
  const live = await bridgeProbeExactTotal(filters);
  if (live > 0) return live;
  return countGamlsListingsFromSupabase(filters);
}

async function fetchBridgeListingsPage(
  filters: ListingFilters,
  skip: number,
  take: number,
): Promise<{ rows: UnifiedListing[]; total: number }> {
  const live = await bridgeFetchUnifiedPage(filters, { skip, take });
  if (live.rows.length > 0) return live;
  if (skip === 0 && live.total > 0) return live;
  return fetchGamlsListingsFromSupabase(filters, { skip, take });
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

async function resolveMultiFeedTotals(
  filters: ListingFilters,
  bridgeOn: boolean,
  sparkOn: boolean,
): Promise<{ bridgeTotal: number; sparkTotal: number }> {
  const [bridgeTotal, sparkTotal] = await Promise.all([
    resolveBridgeTotal(filters, bridgeOn),
    sparkOn ? sparkProbeExactTotal(filters) : Promise.resolve(0),
  ]);
  return { bridgeTotal, sparkTotal };
}

async function getMultiFeedTotals(
  filters: ListingFilters,
  bridgeOn: boolean,
  sparkOn: boolean,
): Promise<{ bridgeTotal: number; sparkTotal: number }> {
  return resolveMultiFeedTotals(filters, bridgeOn, sparkOn);
}

/**
 * Deep multi-feed pagination using feed-sequential routing.
 *
 * Pages 1..ceil(bridgeTotal/perPage) come from Bridge; remaining pages from Spark.
 * Totals come only from skip=0 count probes — never from deep $skip fetches.
 */
async function searchWithMultipleFeeds(
  filters: ListingFilters,
  options?: { skipAddressGeocode?: boolean },
): Promise<PaginatedResult> {
  const poly = filters.mapPolygon;
  if (poly && poly.length >= 3) return searchWithMultipleFeedsPolygon(filters, poly);

  const requestedPage = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 10));

  const bridgeOn = isBridgeListingsEnabled();
  const sparkOn = isSparkListingsEnabled();

  if (!bridgeOn && !sparkOn) {
    return { listings: [], total: 0, page: 1, perPage, totalPages: 0 };
  }

  const { bridgeTotal, sparkTotal } = await getMultiFeedTotals(filters, bridgeOn, sparkOn);

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
    const res = await fetchBridgeListingsPage(filters, globalOffset, perPage);
    rows = res.rows;

    if (rows.length === 0 && sparkOn && sparkTotal > 0) {
      const effectiveBridgeRows =
        bridgeTotal > 0 && bridgeTotal <= globalOffset ? bridgeTotal : globalOffset;
      const sparkSkip = Math.max(0, globalOffset - effectiveBridgeRows);
      const sparkRes = await sparkFetchUnifiedPage(filters, { skip: sparkSkip, take: perPage });
      rows = sparkRes.rows;
    }
  } else {
    const sparkPageIndex = safePage - bridgePages;
    const skip = Math.max(0, (sparkPageIndex - 1) * perPage);
    const res = await sparkFetchUnifiedPage(filters, { skip, take: perPage });
    rows = res.rows;
  }

  let listings = dedupeUnifiedListings(rows);
  listings = applyZipCentroidPinCoords(listings, undefined);
  const needsGeocode =
    !options?.skipAddressGeocode &&
    (filters.mapPolygon != null && filters.mapPolygon.length >= 3);
  if (needsGeocode) {
    listings = await enrichListingsWithPhotonGeocode(listings, {
      polygon: filters.mapPolygon,
    });
  }

  return { listings, total, page: safePage, perPage, totalPages };
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
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 10));

  const allRows: UnifiedListing[] = [];
  if (isBridgeListingsEnabled()) {
    try {
      const bridge = await bridgeFetchTopUnifiedListings(filters, POLYGON_MAX_ROWS_PER_FEED);
      allRows.push(...bridge.rows);
    } catch (e) {
      console.warn("searchWithMultipleFeedsPolygon: bridge failed", e);
    }
  }
  if (isSparkListingsEnabled()) {
    try {
      const spark = await sparkFetchTopUnifiedListings(filters, POLYGON_MAX_ROWS_PER_FEED);
      allRows.push(...spark.rows);
    } catch (e) {
      console.warn("searchWithMultipleFeedsPolygon: spark failed", e);
    }
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

  const manualRows = await manualPromise;
  const all: UnifiedListing[] = [...manualRows];

  if (bridgeOn) {
    try {
      const bridge = await bridgeFetchTopUnifiedListings(filters, MAP_PINS_MAX_ROWS_PER_FEED);
      all.push(...bridge.rows);
    } catch (e) {
      console.warn("fetchAllPinsForMap: bridge failed", e);
    }
  }
  if (sparkOn) {
    try {
      const spark = await sparkFetchTopUnifiedListings(filters, MAP_PINS_MAX_ROWS_PER_FEED);
      all.push(...spark.rows);
    } catch (e) {
      console.warn("fetchAllPinsForMap: spark failed", e);
    }
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

export async function searchWithFilters(
  filters: ListingFilters,
  options?: { skipAddressGeocode?: boolean },
): Promise<PaginatedResult> {
  const bridgeOn = isBridgeListingsEnabled();
  const sparkOn = isSparkListingsEnabled();

  if (bridgeOn && sparkOn) {
    return searchWithMultipleFeeds(filters, options);
  }
  if (bridgeOn) {
    return bridgeSearchWithFilters(filters);
  }
  if (sparkOn) {
    return sparkSearchWithFilters(filters);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { listings: [], total: 0, page: 1, perPage: 10, totalPages: 0 };

  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 10));
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
  const mls = ((mlsResult.data ?? []) as MlsListingRow[]).map((m) => mlsToUnified(m));
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

function isUsableMlsCache(row: MlsListingRow): boolean {
  return Boolean(row.mls_id || row.address_line || row.city) && row.price_cents >= 0;
}

async function getMlsListingFromSupabase(mlsId: string): Promise<MlsListingRow | null> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const client = createSupabaseAdminClient();
  if (!client) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase.from("mls_listings").select("*").eq("mls_id", mlsId).maybeSingle();
    return normalizeMlsListingRow(data);
  }
  const { data, error } = await client.from("mls_listings").select("*").eq("mls_id", mlsId).maybeSingle();
  if (error) {
    console.error("getMlsListingFromSupabase", error.message);
    return null;
  }
  return normalizeMlsListingRow(data);
}

function normalizeMlsListingRow(data: unknown): MlsListingRow | null {
  if (!data || typeof data !== "object") return null;
  const row = data as MlsListingRow;
  return {
    ...row,
    listing_agent: row.listing_agent ?? "",
    listing_agent_phone: row.listing_agent_phone ?? "",
    listing_office: row.listing_office ?? "",
    listing_office_phone: row.listing_office_phone ?? "",
    image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
  };
}

function isWarmMlsCache(row: MlsListingRow): boolean {
  return Array.isArray(row.image_urls) && row.image_urls.length > 0;
}

function isDetailReady(row: MlsListingRow): boolean {
  return isWarmMlsCache(row) && hasMlsAttribution(row) && Boolean(row.description?.length);
}

async function persistMlsListingCache(row: MlsListingRow): Promise<void> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const client = createSupabaseAdminClient();
    if (!client || !row.mls_id) return;
    const now = new Date().toISOString();
    await client.from("mls_listings").upsert(
      {
        mls_id: row.mls_id,
        title: row.title,
        address_line: row.address_line,
        city: row.city,
        state: row.state,
        postal_code: row.postal_code,
        price_cents: row.price_cents,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        square_feet: row.square_feet,
        latitude: row.latitude,
        longitude: row.longitude,
        description: row.description,
        property_type: row.property_type,
        status: row.status || "active",
        image_urls: row.image_urls ?? [],
        listing_agent: row.listing_agent ?? "",
        listing_agent_phone: row.listing_agent_phone ?? "",
        listing_office: row.listing_office ?? "",
        listing_office_phone: row.listing_office_phone ?? "",
        raw_data: row.raw_data ?? {},
        synced_at: now,
        updated_at: now,
      },
      { onConflict: "mls_id" },
    );
  } catch (e) {
    console.warn("persistMlsListingCache", e);
  }
}

/**
 * Resolve a single MLS listing. Deduped per request via React.cache so
 * generateMetadata + the page body share one lookup.
 *
 * Collects cache + live feed results for a short window and merges the richest
 * row (photos + agent/broker + remarks) instead of returning the first sparse hit.
 */
export const getMlsListingById = cache(async (mlsId: string): Promise<MlsListingRow | null> => {
  const id = mlsId.trim();
  if (!id) return null;

  const sources: Array<Promise<MlsListingRow | null>> = [
    getMlsListingFromSupabase(id).then((row) => (row && isUsableMlsCache(row) ? row : null)),
  ];
  if (isBridgeListingsEnabled()) sources.push(bridgeGetMlsListingById(id));
  if (isSparkListingsEnabled()) sources.push(sparkGetMlsListingById(id));

  const collected: MlsListingRow[] = [];
  const DETAIL_WAIT_MS = 5_500;

  await new Promise<void>((resolve) => {
    let pending = sources.length;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(done, DETAIL_WAIT_MS);

    for (const p of sources) {
      p.then((row) => {
        if (row) {
          collected.push(row);
          // Early exit once we have a complete detail-ready listing.
          if (collected.some(isDetailReady) || scoreMlsListingCompleteness(row) >= 50) {
            clearTimeout(timer);
            done();
          }
        }
      })
        .catch(() => undefined)
        .finally(() => {
          pending -= 1;
          if (pending === 0) {
            clearTimeout(timer);
            done();
          }
        });
    }
  });

  // Allow in-flight promises a moment more if we still have nothing.
  if (collected.length === 0) {
    const settled = await Promise.allSettled(sources);
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) collected.push(r.value);
    }
  }

  const merged = mergeMlsListingRows(collected);
  if (merged && (isWarmMlsCache(merged) || hasMlsAttribution(merged))) {
    void persistMlsListingCache(merged);
  }
  return merged;
});

async function listFeaturedSlots(): Promise<
  Array<{ slot_index: number; source: "mls" | "manual"; mls_id: string | null; listing_id: string | null }>
> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("featured_slots")
    .select("slot_index, source, mls_id, listing_id")
    .order("slot_index", { ascending: true });
  if (error) {
    console.error("listFeaturedSlots", error.message);
    return [];
  }
  return (data ?? []) as Array<{
    slot_index: number;
    source: "mls" | "manual";
    mls_id: string | null;
    listing_id: string | null;
  }>;
}

/** Homepage featured homes — curated hybrid slots (MLS or manual). */
export async function getFeaturedUnifiedListings(): Promise<UnifiedListing[]> {
  const slots = await listFeaturedSlots();
  if (slots.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const out: UnifiedListing[] = [];

  for (const slot of slots) {
    if (slot.source === "manual" && slot.listing_id) {
      if (!supabase) continue;
      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("id", slot.listing_id)
        .eq("is_published", true)
        .maybeSingle();
      if (data) out.push(manualToUnified(data as ListingRow));
      continue;
    }
    if (slot.source === "mls" && slot.mls_id) {
      const mls = await getMlsListingById(slot.mls_id);
      if (mls) out.push(mlsToUnified(mls));
    }
  }
  return out;
}

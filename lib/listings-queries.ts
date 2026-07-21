import { cache } from "react";
import { after } from "next/server";
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
import { scoreDreamMatch } from "@/lib/dream-home-match";
import {
  amenitiesFromListingFilters,
  amenitiesToSoftPrefs,
  listingFiltersHaveAmenities,
  stripAmenitiesFromFilters,
} from "@/lib/listing-amenities";
import { applyZipCentroidPinCoords, listingMatchesDrawnPolygon } from "@/lib/map-pin-coords";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";
import { parseCityStateSearchQuery } from "@/lib/listing-query-text";
import {
  hasListingFirmName,
  hasMlsAttribution,
  mergeMlsListingRows,
  scoreMlsListingCompleteness,
} from "@/lib/mls-attribution";
import { fetchRetsAttributionForMlsId, isRetsConfigured } from "@/lib/rets-client";
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
  /** Ephemeral copy for dream-home ranking (remarks); not shown on cards. */
  matchText?: string;
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
  /**
   * Dream-home soft preferences (chip labels). When set, we fetch a wider
   * candidate set and rank by MLS remarks / description keyword match.
   */
  softPrefs?: string[] | undefined;
  /** Internal: include PublicRemarks (etc.) on grid $select for dream ranking. */
  includeRemarksForMatch?: boolean | undefined;
  /** Amenity hard-filters (RESO) — dream Phase 2. */
  hasPool?: boolean | undefined;
  minGarageSpaces?: number | undefined;
  hasFireplace?: boolean | undefined;
  hasWaterfront?: boolean | undefined;
  minYearBuilt?: number | undefined;
  maxYearBuilt?: number | undefined;
  maxStories?: number | undefined;
  minAcres?: number | undefined;
  noHoa?: boolean | undefined;
}

export interface PaginatedResult {
  listings: UnifiedListing[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  /** Bridge: OData bbox returned nothing (often null coords in MLS); we widened to text filters + ZIP-centroid match inside the draw. */
  mapPolygonWideFetch?: boolean | undefined;
  /** Amenity hard-filters returned 0 / errored — retried with keyword ranking only. */
  amenityFilterLoosened?: boolean | undefined;
}

function manualToUnified(l: ListingRow): UnifiedListing {
  const base: UnifiedListing = {
    id: l.id, slug: l.slug, mls_id: null, title: l.title,
    address_line: l.address_line, city: l.city, state: l.state,
    postal_code: l.postal_code, price_cents: l.price_cents,
    bedrooms: l.bedrooms, bathrooms: l.bathrooms,
    square_feet: l.square_feet, latitude: l.latitude,
    longitude: l.longitude, image_urls: l.image_urls, source: "manual",
    feed: "manual",
  };
  if (l.description?.trim()) base.matchText = l.description.trim();
  return base;
}

function mlsToUnified(m: MlsListingRow, feed: ListingFeed = "bridge"): UnifiedListing {
  const base: UnifiedListing = {
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
  if (m.description?.trim()) base.matchText = m.description.trim();
  return base;
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

  let unified = dedupeUnifiedListings(allRows).filter((u) =>
    listingMatchesDrawnPolygon(u, poly),
  );
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
  rows = await enrichListingsWithPhotonGeocode(
    rows,
    filters.mapPolygon ? { polygon: filters.mapPolygon } : undefined,
  );

  // ZIP centroid pins are already constrained to the outline; keep anything we can plot.
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

const DREAM_CANDIDATE_CAP = 100;

function hardFiltersOnly(filters: ListingFilters): ListingFilters {
  const out: ListingFilters = {
    page: 1,
    perPage: DREAM_CANDIDATE_CAP,
  };
  if (filters.q) out.q = filters.q;
  if (filters.minPrice != null) out.minPrice = filters.minPrice;
  if (filters.maxPrice != null) out.maxPrice = filters.maxPrice;
  if (filters.minBeds != null) out.minBeds = filters.minBeds;
  if (filters.minBaths != null) out.minBaths = filters.minBaths;
  if (filters.minSqft != null) out.minSqft = filters.minSqft;
  if (filters.maxSqft != null) out.maxSqft = filters.maxSqft;
  if (filters.propertyType) out.propertyType = filters.propertyType;
  if (filters.sort) out.sort = filters.sort;
  if (filters.mapPolygon) out.mapPolygon = filters.mapPolygon;
  if (filters.softPrefs && filters.softPrefs.length > 0) {
    out.includeRemarksForMatch = true;
  }
  if (filters.hasPool) out.hasPool = true;
  if (filters.minGarageSpaces != null) out.minGarageSpaces = filters.minGarageSpaces;
  if (filters.hasFireplace) out.hasFireplace = true;
  if (filters.hasWaterfront) out.hasWaterfront = true;
  if (filters.minYearBuilt != null) out.minYearBuilt = filters.minYearBuilt;
  if (filters.maxYearBuilt != null) out.maxYearBuilt = filters.maxYearBuilt;
  if (filters.maxStories != null) out.maxStories = filters.maxStories;
  if (filters.minAcres != null) out.minAcres = filters.minAcres;
  if (filters.noHoa) out.noHoa = true;
  return out;
}

/** Pull MLS / manual descriptions so dream keywords can score against real listing copy. */
async function fetchDreamMatchTexts(listings: UnifiedListing[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const l of listings) {
    const base = [l.matchText, l.title, l.address_line, l.city, l.state, l.postal_code]
      .filter(Boolean)
      .join(" ");
    map.set(l.id, base);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase || listings.length === 0) return map;

  const mlsIds = [
    ...new Set(listings.map((l) => l.mls_id).filter((id): id is string => Boolean(id))),
  ].slice(0, DREAM_CANDIDATE_CAP);
  const rowIds = listings.map((l) => l.id).slice(0, DREAM_CANDIDATE_CAP);

  try {
    if (mlsIds.length > 0) {
      const { data } = await supabase
        .from("mls_listings")
        .select("id, mls_id, title, description, address_line, city, property_type")
        .in("mls_id", mlsIds);
      for (const row of data ?? []) {
        const r = row as {
          id: string;
          mls_id: string;
          title?: string;
          description?: string;
          address_line?: string;
          city?: string;
          property_type?: string;
        };
        const blob = [r.title, r.description, r.address_line, r.city, r.property_type]
          .filter(Boolean)
          .join(" ");
        if (!blob) continue;
        const match = listings.find((l) => l.mls_id === r.mls_id || l.id === r.id);
        if (match) {
          map.set(match.id, `${map.get(match.id) ?? ""} ${blob}`);
        }
      }
    }

    const manualIds = listings.filter((l) => l.source === "manual").map((l) => l.id);
    if (manualIds.length > 0) {
      const { data } = await supabase
        .from("listings")
        .select("id, title, description, address_line, city")
        .in("id", manualIds);
      for (const row of data ?? []) {
        const r = row as {
          id: string;
          title?: string;
          description?: string;
          address_line?: string;
          city?: string;
        };
        const blob = [r.title, r.description, r.address_line, r.city].filter(Boolean).join(" ");
        if (blob) map.set(r.id, `${map.get(r.id) ?? ""} ${blob}`);
      }
    }

    // Also try matching by listing id on mls_listings (Bridge keys)
    if (rowIds.length > 0) {
      const { data } = await supabase
        .from("mls_listings")
        .select("id, title, description, address_line, city, property_type")
        .in("id", rowIds);
      for (const row of data ?? []) {
        const r = row as {
          id: string;
          title?: string;
          description?: string;
          address_line?: string;
          city?: string;
          property_type?: string;
        };
        const blob = [r.title, r.description, r.address_line, r.city, r.property_type]
          .filter(Boolean)
          .join(" ");
        if (blob) map.set(r.id, `${map.get(r.id) ?? ""} ${blob}`);
      }
    }
  } catch (err) {
    console.warn("fetchDreamMatchTexts", err);
  }

  return map;
}

/**
 * Dream search ranking: hard filters narrow the set; soft prefs reorder so
 * homes whose remarks mention pool/garage/etc. surface first.
 */
async function searchWithDreamKeywordRank(
  filters: ListingFilters,
  options?: { skipAddressGeocode?: boolean },
): Promise<PaginatedResult> {
  const softPrefs = filters.softPrefs ?? [];
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 10));
  const hard = hardFiltersOnly(filters);

  const bridgeOn = isBridgeListingsEnabled();
  const sparkOn = isSparkListingsEnabled();

  let candidates: UnifiedListing[] = [];

  if (bridgeOn || sparkOn) {
    const [bridgeRes, sparkRes] = await Promise.all([
      bridgeOn
        ? bridgeFetchTopUnifiedListings(hard, Math.min(60, DREAM_CANDIDATE_CAP))
        : Promise.resolve({ rows: [] as UnifiedListing[], total: 0 }),
      sparkOn
        ? sparkFetchTopUnifiedListings(hard, Math.min(60, DREAM_CANDIDATE_CAP))
        : Promise.resolve({ rows: [] as UnifiedListing[], total: 0 }),
    ]);
    candidates = dedupeUnifiedListings([...bridgeRes.rows, ...sparkRes.rows]);
  } else {
    // Supabase-only inventory — reuse the non-dream path with a wide page.
    const wide = await searchWithFilters(
      { ...hard, softPrefs: undefined, page: 1, perPage: DREAM_CANDIDATE_CAP },
      options,
    );
    candidates = wide.listings;
  }

  candidates = applyZipCentroidPinCoords(candidates, undefined);

  const texts = await fetchDreamMatchTexts(candidates);
  const sort = filters.sort ?? "price_desc";

  const scored = candidates.map((listing) => {
    const { score } = scoreDreamMatch(texts.get(listing.id) ?? "", softPrefs);
    return { listing, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    switch (sort) {
      case "price_asc":
        return a.listing.price_cents - b.listing.price_cents;
      case "sqft_desc":
        return (b.listing.square_feet ?? 0) - (a.listing.square_feet ?? 0);
      case "newest":
        return a.listing.source === "manual" ? -1 : 1;
      case "price_desc":
      default:
        return b.listing.price_cents - a.listing.price_cents;
    }
  });

  const total = scored.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const from = (safePage - 1) * perPage;
  let listings = scored.slice(from, from + perPage).map((s) => s.listing);

  if (
    !options?.skipAddressGeocode &&
    filters.mapPolygon != null &&
    filters.mapPolygon.length >= 3
  ) {
    listings = await enrichListingsWithPhotonGeocode(listings, {
      polygon: filters.mapPolygon,
    });
  }

  return { listings, total, page: safePage, perPage, totalPages };
}

export async function searchWithFilters(
  filters: ListingFilters,
  options?: { skipAddressGeocode?: boolean },
): Promise<PaginatedResult> {
  const result = await searchWithFiltersCore(filters, options);

  // Amenity hard-filters: if MLS rejects the field or nothing matches, loosen
  // to keyword ranking so dream search never goes empty on sparse amenities.
  if (
    listingFiltersHaveAmenities(filters) &&
    result.total === 0 &&
    !(filters.mapPolygon && filters.mapPolygon.length >= 3)
  ) {
    const amenities = amenitiesFromListingFilters(filters);
    const soft = Array.from(
      new Set([...(filters.softPrefs ?? []), ...amenitiesToSoftPrefs(amenities)]),
    ).slice(0, 8);
    const loosened: ListingFilters = {
      ...stripAmenitiesFromFilters(filters),
      ...(soft.length > 0 ? { softPrefs: soft } : {}),
    };
    const retry = await searchWithFiltersCore(loosened, options);
    return { ...retry, amenityFilterLoosened: true };
  }

  return result;
}

async function searchWithFiltersCore(
  filters: ListingFilters,
  options?: { skipAddressGeocode?: boolean },
): Promise<PaginatedResult> {
  // Dream soft prefs: widen candidates + rank by remarks/description match.
  if (
    filters.softPrefs &&
    filters.softPrefs.length > 0 &&
    !(filters.mapPolygon && filters.mapPolygon.length >= 3)
  ) {
    return searchWithDreamKeywordRank(filters, options);
  }

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
    const filtered = allListings.filter((l) => listingMatchesDrawnPolygon(l, poly));
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
  // Photos are enough to paint the page; attribution can arrive from a richer merge
  // or stay empty when the IDX feed omits it. Don't block navigation on agent fields.
  return isWarmMlsCache(row) && Boolean(row.address_line || row.city);
}

/** Prefer a human display name over a bare MLS code; never invent blanks over existing data. */
function preferAttributionText(incoming?: string | null, existing?: string | null): string {
  const a = (incoming || "").trim();
  const b = (existing || "").trim();
  const code = (s: string) => /^[A-Z0-9]{3,24}$/i.test(s) && !/\s/.test(s);
  if (a && !code(a)) return a;
  if (b && !code(b)) return b;
  return a || b;
}

async function persistMlsListingCache(row: MlsListingRow): Promise<void> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const client = createSupabaseAdminClient();
    if (!client || !row.mls_id) return;

    // Never blank attribution that RETS (or a prior enrich) already stored when Bridge IDX omits it.
    // Prefer real firm/agent names over short MLS codes when merging.
    const existing = await getMlsListingFromSupabase(row.mls_id);
    const listing_agent = preferAttributionText(row.listing_agent, existing?.listing_agent);
    const listing_agent_phone = preferAttributionText(
      row.listing_agent_phone,
      existing?.listing_agent_phone,
    );
    const listing_office = preferAttributionText(row.listing_office, existing?.listing_office);
    const listing_office_phone = preferAttributionText(
      row.listing_office_phone,
      existing?.listing_office_phone,
    );
    const raw_data = {
      ...(existing?.raw_data ?? {}),
      ...(row.raw_data ?? {}),
    };

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
        listing_agent,
        listing_agent_phone,
        listing_office,
        listing_office_phone,
        raw_data,
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
 * Fast path: return as soon as a photo-ready row appears (Supabase or live Property).
 * Never abandon an in-flight live fetch — that was causing soft-404s under MLS latency.
 * Media-entity / attribution polish runs after the response via `after()`.
 */
export const getMlsListingById = cache(async (mlsId: string): Promise<MlsListingRow | null> => {
  const id = mlsId.trim();
  if (!id) return null;

  const supabaseP = getMlsListingFromSupabase(id).then((row) =>
    row && isUsableMlsCache(row) ? row : null,
  );
  const bridgeOn = isBridgeListingsEnabled();
  const sparkOn = isSparkListingsEnabled();
  const primaryLiveP = bridgeOn
    ? bridgeGetMlsListingById(id, { fullEnrich: false })
    : sparkOn
      ? sparkGetMlsListingById(id, { fullEnrich: false })
      : Promise.resolve(null);

  const collected: MlsListingRow[] = [];
  const FAST_WAIT_MS = 2_500;

  await new Promise<void>((resolve) => {
    let pending = 2;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(done, FAST_WAIT_MS);

    const onRow = (row: MlsListingRow | null) => {
      if (row) {
        collected.push(row);
        if (collected.some(isDetailReady) || scoreMlsListingCompleteness(row) >= 24) {
          clearTimeout(timer);
          done();
        }
      }
    };

    for (const p of [supabaseP, primaryLiveP]) {
      p.then(onRow)
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

  let merged = mergeMlsListingRows(collected);
  if (merged && isDetailReady(merged)) {
    merged = (await ensureListingFirmFromRets(id, merged)) ?? merged;
    void persistMlsListingCache(merged);
    scheduleBackgroundMlsEnrich(id, merged);
    return merged;
  }

  // Dual-feed fallback while primary may still be running.
  if ((!merged || !isDetailReady(merged)) && sparkOn && bridgeOn) {
    const sparkRow = await Promise.race([
      sparkGetMlsListingById(id, { fullEnrich: false }),
      new Promise<null>((r) => setTimeout(() => r(null), 3_000)),
    ]);
    if (sparkRow) {
      collected.push(sparkRow);
      merged = mergeMlsListingRows(collected);
      if (merged && isDetailReady(merged)) {
        merged = (await ensureListingFirmFromRets(id, merged)) ?? merged;
        void persistMlsListingCache(merged);
        scheduleBackgroundMlsEnrich(id, merged);
        return merged;
      }
    }
  }

  // Critical: if still empty, wait for the primary live promise to finish.
  // A short race here previously returned null → soft 404 while Bridge was still in flight.
  if (collected.length === 0) {
    const primaryRow = await Promise.race([
      primaryLiveP.catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 18_000)),
    ]);
    if (primaryRow) collected.push(primaryRow);
    const supabaseRow = await supabaseP.catch(() => null);
    if (supabaseRow) collected.push(supabaseRow);
    merged = mergeMlsListingRows(collected);
  } else {
    merged = mergeMlsListingRows(collected);
  }

  // Last resort: Spark if Bridge primary produced nothing.
  if (!merged && sparkOn && bridgeOn) {
    const sparkRow = await sparkGetMlsListingById(id, { fullEnrich: false }).catch(() => null);
    if (sparkRow) {
      collected.push(sparkRow);
      merged = mergeMlsListingRows(collected);
    }
  }

  if (merged) {
    merged = (await ensureListingFirmFromRets(id, merged)) ?? merged;
  }

  if (merged && (isWarmMlsCache(merged) || hasMlsAttribution(merged) || isUsableMlsCache(merged))) {
    void persistMlsListingCache(merged);
  }

  if (merged && isDetailReady(merged)) {
    scheduleBackgroundMlsEnrich(id, merged);
  }
  return merged;
});

/** Request-path RETS firm resolution when Bridge/Spark leave listing_office blank or coded. */
async function ensureListingFirmFromRets(
  id: string,
  row: MlsListingRow,
): Promise<MlsListingRow> {
  if (hasListingFirmName(row) && !attributionNeedsRetsResolve(row)) return row;
  if (isRetsConfigured()) {
    const withRets = await applyRetsAttribution(id, row);
    return withRets ?? row;
  }
  return {
    ...row,
    raw_data: {
      ...row.raw_data,
      _retsAttribution: {
        ok: false,
        reason: "rets_not_configured",
        at: new Date().toISOString(),
      },
    },
  };
}

/** True when we lack usable agent/broker display names (empty or MLS user/office codes). */
function attributionNeedsRetsResolve(row: MlsListingRow): boolean {
  if (!hasListingFirmName(row)) return true;
  if (!hasMlsAttribution(row)) return true;
  const agent = (row.listing_agent || "").trim();
  const office = (row.listing_office || "").trim();
  const looksLikeCode = (s: string) => /^[A-Z0-9]{3,24}$/i.test(s) && !/\s/.test(s);
  if (agent && looksLikeCode(agent)) return true;
  if (office && looksLikeCode(office)) return true;
  return false;
}

async function applyRetsAttribution(
  id: string,
  seed: MlsListingRow,
): Promise<MlsListingRow | null> {
  try {
    const attr = await Promise.race([
      fetchRetsAttributionForMlsId(id),
      new Promise<null>((r) => setTimeout(() => r(null), 12_000)),
    ]);
    if (!attr) {
      return {
        ...seed,
        raw_data: {
          ...seed.raw_data,
          _retsAttribution: {
            ok: false,
            reason: "timeout_or_empty",
            at: new Date().toISOString(),
          },
        },
      };
    }
    const priorDiag =
      attr.raw_data &&
      typeof attr.raw_data === "object" &&
      attr.raw_data._retsAttribution &&
      typeof attr.raw_data._retsAttribution === "object"
        ? (attr.raw_data._retsAttribution as Record<string, unknown>)
        : null;
    const hasFirmOrAgent = Boolean(
      (attr.listing_office || "").trim() || (attr.listing_agent || "").trim(),
    );
    return {
      ...seed,
      listing_agent: preferAttributionText(attr.listing_agent, seed.listing_agent),
      listing_agent_phone: preferAttributionText(attr.listing_agent_phone, seed.listing_agent_phone),
      listing_office: preferAttributionText(attr.listing_office, seed.listing_office),
      listing_office_phone: preferAttributionText(attr.listing_office_phone, seed.listing_office_phone),
      raw_data: {
        ...seed.raw_data,
        ...attr.raw_data,
        _retsAttribution: {
          ...(priorDiag ?? {}),
          ok: hasFirmOrAgent || priorDiag?.ok === true,
          listing_agent: attr.listing_agent,
          listing_office: attr.listing_office,
          at: new Date().toISOString(),
        },
      },
    };
  } catch (e) {
    console.warn("applyRetsAttribution", e);
    return {
      ...seed,
      raw_data: {
        ...seed.raw_data,
        _retsAttribution: {
          ok: false,
          reason: e instanceof Error ? e.message : String(e),
          at: new Date().toISOString(),
        },
      },
    };
  }
}

async function enrichMlsListingInBackground(id: string, seed: MlsListingRow): Promise<void> {
  try {
    const needsMedia = !isWarmMlsCache(seed);
    const needsAttr = attributionNeedsRetsResolve(seed);
    if (!needsMedia && !needsAttr) return;

    const parts: MlsListingRow[] = [seed];
    if (isBridgeListingsEnabled()) {
      const row = await bridgeGetMlsListingById(id, {
        fullEnrich: needsMedia || needsAttr,
      }).catch(() => null);
      if (row) parts.push(row);
    }
    if (isSparkListingsEnabled() && (needsMedia || needsAttr)) {
      const row = await sparkGetMlsListingById(id, { fullEnrich: needsMedia }).catch(() => null);
      if (row) parts.push(row);
    }
    let merged = mergeMlsListingRows(parts) ?? seed;
    if (attributionNeedsRetsResolve(merged) && isRetsConfigured()) {
      const withRets = await applyRetsAttribution(id, merged);
      if (withRets) merged = withRets;
    }
    if (merged && (isWarmMlsCache(merged) || hasMlsAttribution(merged))) {
      await persistMlsListingCache(merged);
    }
  } catch (e) {
    console.warn("enrichMlsListingInBackground", e);
  }
}

function scheduleBackgroundMlsEnrich(id: string, seed: MlsListingRow): void {
  try {
    after(() => {
      void enrichMlsListingInBackground(id, seed);
    });
  } catch {
    void enrichMlsListingInBackground(id, seed);
  }
}

/**
 * Warm Supabase cache for an MLS id (e.g. when search suggestions show an address).
 * Photos only from Bridge/Spark — never overwrite RETS attribution with empty IDX fields.
 */
export async function warmMlsListingCache(mlsId: string): Promise<boolean> {
  const id = mlsId.trim();
  if (!id) return false;

  const existing = await getMlsListingFromSupabase(id);
  if (existing && isDetailReady(existing) && hasListingFirmName(existing)) return true;

  let row: MlsListingRow | null = null;
  if (isBridgeListingsEnabled()) {
    row = await bridgeGetMlsListingById(id, { fullEnrich: false }).catch(() => null);
  }
  if ((!row || !isDetailReady(row)) && isSparkListingsEnabled()) {
    const spark = await sparkGetMlsListingById(id, { fullEnrich: false }).catch(() => null);
    row = mergeMlsListingRows([row, spark].filter(Boolean) as MlsListingRow[]);
  }
  if (!row || !isWarmMlsCache(row)) return false;

  // Strip empty attribution so persistMlsListingCache keeps any existing RETS firm/agent.
  const safe: MlsListingRow = {
    ...row,
    listing_agent: row.listing_agent?.trim() || "",
    listing_agent_phone: row.listing_agent_phone?.trim() || "",
    listing_office: row.listing_office?.trim() || "",
    listing_office_phone: row.listing_office_phone?.trim() || "",
  };
  if (
    isRetsConfigured() &&
    !hasListingFirmName(existing ?? safe) &&
    attributionNeedsRetsResolve(safe)
  ) {
    const withRets = await applyRetsAttribution(id, safe);
    if (withRets) {
      await persistMlsListingCache(withRets);
      return true;
    }
  }
  await persistMlsListingCache(safe);
  return true;
}

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

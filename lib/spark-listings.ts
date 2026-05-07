/**
 * Spark Platform — RESO Web API v3 listing queries.
 *
 * Mirrors the public surface of `bridge-listings.ts` so the unified search
 * layer can call either feed (or both) without branching on vendor.
 *
 * This module reuses the RESO-generic Property → core fields mapper from
 * `bridge-odata.ts` (it operates on standard RESO Data Dictionary names and
 * is therefore vendor-neutral).
 */

import {
  bridgePropertyToCoreFields,
  bridgeRowHasRemarkFields,
  type BridgePropertyMapOptions,
} from "@/lib/bridge-odata";
import { enrichListingsWithPhotonGeocode } from "@/lib/geocode-listing-address";
import { gaZipCentroid, normalizeUsZip5 } from "@/lib/ga-zip-centroids";
import { applyZipCentroidPinCoords } from "@/lib/map-pin-coords";
import { pointInPolygon } from "@/lib/geo";
import { parseCityStateSearchQuery } from "@/lib/listing-query-text";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";
import type { ListingFilters, PaginatedResult, UnifiedListing } from "@/lib/listings-queries";
import type { SearchSuggestion } from "@/lib/listing-search-suggest";
import {
  escapeODataString,
  fetchSparkMediaUrlsForListing,
  getSparkODataConfig,
  sparkODataGet,
  type SparkODataConfig,
} from "@/lib/spark-odata";
import type { ODataValueResponse } from "@/lib/reso-odata";
import type { MlsListingRow } from "@/lib/types/db";
import { US_STATE_ABBR_TO_NAME } from "@/lib/us-state-names";

/** Active-ish listings; defensive against feeds that store status with mixed case / nulls. */
const ACTIVE =
  "((StandardStatus eq 'Active') or (tolower(StandardStatus) eq 'active') or (MlsStatus eq 'Active') or (tolower(MlsStatus) eq 'active'))";

/** Some feeds store full state name ("Georgia") while users type "GA" — handle both. */
function stateOrProvinceODataClause(stateUser: string): string {
  const s = stateUser.trim();
  if (!s) return "(true)";
  const parts: string[] = [];
  const upper = s.toUpperCase();
  if (/^[A-Za-z]{2}$/.test(s) && US_STATE_ABBR_TO_NAME[upper]) {
    const abbr = s.toLowerCase();
    const full = US_STATE_ABBR_TO_NAME[upper].toLowerCase();
    parts.push(`tolower(StateOrProvince) eq '${escapeODataString(abbr)}'`);
    parts.push(`contains(tolower(StateOrProvince), '${escapeODataString(full)}')`);
  } else {
    parts.push(`contains(tolower(StateOrProvince), '${escapeODataString(s.toLowerCase())}')`);
    for (const [abbr, name] of Object.entries(US_STATE_ABBR_TO_NAME)) {
      if (name.toLowerCase() === s.toLowerCase()) {
        parts.push(`tolower(StateOrProvince) eq '${escapeODataString(abbr.toLowerCase())}'`);
        break;
      }
    }
  }
  return `(${parts.join(" or ")})`;
}

export function isSparkListingsEnabled(): boolean {
  return getSparkODataConfig() != null;
}

function rowToUnified(row: Record<string, unknown>, mapOpts?: BridgePropertyMapOptions): UnifiedListing {
  const c = bridgePropertyToCoreFields(row, mapOpts);
  const base: UnifiedListing = {
    id: c.listingKey || c.listingId,
    slug: null,
    mls_id: c.listingId || c.listingKey,
    title: c.title,
    address_line: c.address_line,
    city: c.city,
    state: c.state,
    postal_code: c.postal_code,
    price_cents: c.price_cents,
    bedrooms: c.bedrooms,
    bathrooms: c.bathrooms,
    square_feet: c.square_feet,
    latitude: c.latitude,
    longitude: c.longitude,
    image_urls: c.image_urls,
    source: "mls",
    feed: "spark",
  };
  if (c.listing_agent) base.listing_agent = c.listing_agent;
  if (c.listing_office) base.listing_office = c.listing_office;
  return base;
}

function rowToMlsListingRow(row: Record<string, unknown>, mapOpts?: BridgePropertyMapOptions): MlsListingRow {
  const c = bridgePropertyToCoreFields(row, mapOpts);
  const now = new Date().toISOString();
  return {
    id: c.listingKey || c.listingId,
    mls_id: c.listingId || c.listingKey,
    title: c.title,
    address_line: c.address_line,
    city: c.city,
    state: c.state,
    postal_code: c.postal_code,
    price_cents: c.price_cents,
    bedrooms: c.bedrooms,
    bathrooms: c.bathrooms,
    square_feet: c.square_feet,
    latitude: c.latitude,
    longitude: c.longitude,
    description: c.description,
    property_type: c.property_type,
    status: c.status,
    image_urls: c.image_urls,
    listing_agent: c.listing_agent,
    listing_office: c.listing_office,
    raw_data: row,
    synced_at: now,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Search/grid: fields needed for cards + map + filters + Media.
 * Spark’s RESO endpoint is generally less restrictive than gamls2 IDX, so we
 * include Lat/Lng and agent/office fields by default.
 */
const SELECT_GRID = [
  "ListingKey",
  "ListingId",
  "UnparsedAddress",
  "StreetNumber",
  "StreetDirPrefix",
  "StreetName",
  "StreetSuffix",
  "StreetDirSuffix",
  "UnitNumber",
  "City",
  "StateOrProvince",
  "PostalCode",
  "ListPrice",
  "BedroomsTotal",
  "BathroomsTotalInteger",
  "BathroomsFull",
  "BathroomsHalf",
  "BathroomsTotalDecimal",
  "LivingArea",
  "PropertyType",
  "PropertySubType",
  "StandardStatus",
  "MlsStatus",
  "SubdivisionName",
  "Latitude",
  "Longitude",
  "ListAgentFullName",
  "ListOfficeName",
  "Media",
  "ModificationTimestamp",
].join(",");

const SELECT_DETAIL = `${SELECT_GRID},PublicRemarks,SupplementalPublicRemarks,PrivateRemarks,InternetRemarks`;

/** Sparser fallback if the feed rejects PublicRemarks (rare on Spark, but cheap insurance). */
const SELECT_DETAIL_SAFE = SELECT_GRID;

const REMARK_SUPPLEMENT_SELECTS = [
  "ListingKey,ListingId,PublicRemarks,SupplementalPublicRemarks,PrivateRemarks,InternetRemarks",
  "ListingKey,ListingId,PublicRemarks,InternetRemarks",
  "ListingKey,ListingId,PublicRemarks",
];

function detailSelectCandidates(): string[] {
  const override = process.env.SPARK_PROPERTY_SELECT_DETAIL?.trim();
  return [...new Set([override || SELECT_DETAIL, SELECT_DETAIL, SELECT_DETAIL_SAFE].filter(Boolean))];
}

function listingIdFilterVariants(rawId: string, esc: string): string[] {
  const quoted = `(ListingId eq '${esc}' or ListingKey eq '${esc}')`;
  const out: string[] = [`${ACTIVE} and ${quoted}`, quoted];
  if (/^\d+$/.test(rawId)) {
    const n = rawId;
    const intish = `(ListingId eq ${n} or ListingKey eq ${n} or ListingKey eq '${esc}')`;
    out.push(`${ACTIVE} and ${intish}`, intish);
  }
  if (/^\d{6,}$/.test(rawId)) {
    const sub = `(contains(ListingKey, '${esc}'))`;
    out.push(`${ACTIVE} and ${sub}`, sub);
  }
  return [...new Set(out)];
}

type BuildFilterOptions = {
  /** Map draw — pass 2: keep state filter only (polygon is the geography). */
  mapPolygonWide?: boolean | undefined;
};

function buildFilter(filters: ListingFilters, options?: BuildFilterOptions): string {
  const parts: string[] = [ACTIVE];

  if (filters.minPrice != null) parts.push(`ListPrice ge ${filters.minPrice}`);
  if (filters.maxPrice != null) parts.push(`ListPrice le ${filters.maxPrice}`);
  if (filters.minBeds != null) parts.push(`BedroomsTotal ge ${Math.floor(filters.minBeds)}`);
  if (filters.minBaths != null) {
    const b = filters.minBaths;
    parts.push(`((BathroomsTotalDecimal ge ${b}) or (BathroomsTotalInteger ge ${Math.ceil(b)}))`);
  }
  if (filters.minSqft != null) parts.push(`LivingArea ge ${Math.floor(filters.minSqft)}`);
  if (filters.maxSqft != null) parts.push(`LivingArea le ${Math.floor(filters.maxSqft)}`);
  if (filters.propertyType?.trim()) {
    const t = escapeODataString(filters.propertyType.trim().toLowerCase());
    parts.push(`contains(tolower(PropertyType), '${t}')`);
  }

  const q = filters.q?.trim();
  if (q) {
    const cityState = parseCityStateSearchQuery(q);
    if (cityState && options?.mapPolygonWide) {
      parts.push(stateOrProvinceODataClause(cityState.state));
    } else if (cityState) {
      const city = escapeODataString(cityState.city.toLowerCase());
      parts.push(
        `(contains(tolower(City), '${city}') or contains(tolower(UnparsedAddress), '${city}'))`,
      );
      parts.push(stateOrProvinceODataClause(cityState.state));
    } else {
      const t = escapeODataString(q.toLowerCase());
      const zipish = /^[\d-]+$/.test(q.replace(/\s/g, ""));
      if (zipish) {
        const z = escapeODataString(q.replace(/\s/g, ""));
        parts.push(`contains(PostalCode, '${z}')`);
      } else {
        parts.push(
          `(contains(tolower(City), '${t}') or contains(tolower(UnparsedAddress), '${t}') or contains(tolower(PostalCode), '${t}') or contains(tolower(StateOrProvince), '${t}') or contains(tolower(SubdivisionName), '${t}'))`,
        );
      }
    }
  }

  const poly = filters.mapPolygon;
  if (poly && poly.length >= 3) {
    const lats = poly.map((p) => p.lat);
    const lngs = poly.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    parts.push(`Latitude ge ${minLat} and Latitude le ${maxLat}`);
    parts.push(`Longitude ge ${minLng} and Longitude le ${maxLng}`);
  }

  return parts.join(" and ");
}

function orderByClause(sort: ListingFilters["sort"]): string {
  switch (sort) {
    case "price_asc":
      return "ListPrice asc";
    case "sqft_desc":
      return "LivingArea desc";
    case "newest":
      return "ModificationTimestamp desc";
    case "price_desc":
    default:
      return "ListPrice desc";
  }
}

/** Spark RESO Web API allows higher $top than gamls2; default 200 keeps payloads sane. */
const SPARK_PROPERTY_PAGE_SIZE = Math.min(
  500,
  Math.max(1, Number.parseInt(process.env.SPARK_ODATA_MAX_TOP?.trim() ?? "200", 10) || 200),
);

const MAP_POLYGON_MAX_ROWS_PRIMARY = Math.min(
  4_000,
  Math.max(200, Number.parseInt(process.env.SPARK_MAP_POLYGON_MAX_ROWS?.trim() ?? "1600", 10) || 1600),
);

const MAP_POLYGON_MAX_ROWS_WIDE = Math.min(
  6_000,
  Math.max(400, Number.parseInt(process.env.SPARK_MAP_POLYGON_MAX_ROWS_WIDE?.trim() ?? "2400", 10) || 2400),
);

function omitMapPolygon(filters: ListingFilters): ListingFilters {
  const { mapPolygon: _drop, ...rest } = filters;
  return rest;
}

function filterUnifiedListingsToDrawnPolygon(
  unified: UnifiedListing[],
  poly: ReadonlyArray<MapPolygonVertex> | undefined,
): UnifiedListing[] {
  if (!poly || poly.length < 3) return unified;
  return unified.filter((u) => {
    if (u.latitude != null && u.longitude != null) {
      return pointInPolygon(u.latitude, u.longitude, poly);
    }
    const zip = normalizeUsZip5(u.postal_code);
    const c = zip ? gaZipCentroid(zip) : null;
    if (c) return pointInPolygon(c.lat, c.lng, poly);
    return false;
  });
}

async function fetchPropertyRows(
  cfg: SparkODataConfig,
  filter: string,
  select: string,
  orderBy: string,
  takeUpTo: number,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const pageSize = SPARK_PROPERTY_PAGE_SIZE;
  let odataSkip = 0;

  while (out.length < takeUpTo) {
    const take = Math.min(pageSize, takeUpTo - out.length);
    const data = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
      $filter: filter,
      $select: select,
      $top: String(take),
      $skip: String(odataSkip),
      $orderby: orderBy,
    });
    const batch = data.value ?? [];
    out.push(...batch);
    if (batch.length === 0) break;
    odataSkip += batch.length;
    if (batch.length < take) break;
  }

  return out;
}

async function enrichListingsPageForMapPins(
  listings: UnifiedListing[],
  polygon?: ReadonlyArray<MapPolygonVertex> | undefined,
): Promise<UnifiedListing[]> {
  let out = applyZipCentroidPinCoords(listings, polygon);
  out = await enrichListingsWithPhotonGeocode(out, { polygon });
  return out;
}

async function sparkSearchWithMapPolygon(
  cfg: SparkODataConfig,
  filters: ListingFilters,
): Promise<PaginatedResult> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(200, Math.max(1, filters.perPage ?? 24));
  const skip = (page - 1) * perPage;

  const select = SELECT_GRID;
  const orderBy = orderByClause(filters.sort);
  const primaryFilter = buildFilter(filters);
  const poly = filters.mapPolygon;

  let rows: Record<string, unknown>[] = [];
  let wideFetch = false;

  try {
    rows = await fetchPropertyRows(cfg, primaryFilter, select, orderBy, MAP_POLYGON_MAX_ROWS_PRIMARY);
  } catch (e1) {
    console.warn("sparkSearchWithMapPolygon: primary OData failed; trying widened search", e1);
    rows = [];
  }

  let unified = rows.map((row) => rowToUnified(row));
  if (poly && poly.length >= 3) {
    unified = filterUnifiedListingsToDrawnPolygon(unified, poly);
  }

  const needWide = poly && poly.length >= 3 && unified.length === 0;
  if (needWide) {
    try {
      const wideFilter = buildFilter(omitMapPolygon(filters), { mapPolygonWide: true });
      try {
        rows = await fetchPropertyRows(cfg, wideFilter, select, "ModificationTimestamp desc", MAP_POLYGON_MAX_ROWS_WIDE);
      } catch (eTs) {
        console.warn(
          "sparkSearchWithMapPolygon: wide query $orderby ModificationTimestamp failed; retrying with list sort",
          eTs,
        );
        rows = await fetchPropertyRows(cfg, wideFilter, select, orderBy, MAP_POLYGON_MAX_ROWS_WIDE);
      }
      wideFetch = true;
      unified = rows.map((row) => rowToUnified(row));
      unified = filterUnifiedListingsToDrawnPolygon(unified, poly);
    } catch (e2) {
      console.warn("sparkSearchWithMapPolygon: widened OData request failed", e2);
      return { listings: [], total: 0, page, perPage, totalPages: 0 };
    }
  }

  const total = unified.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
  let listings = unified.slice(skip, skip + perPage);
  listings = await enrichListingsPageForMapPins(listings, poly);
  return {
    listings,
    total,
    page,
    perPage,
    totalPages,
    mapPolygonWideFetch: wideFetch || undefined,
  };
}

export async function sparkSearchWithFilters(filters: ListingFilters): Promise<PaginatedResult> {
  const cfg = getSparkODataConfig();
  if (!cfg) {
    return { listings: [], total: 0, page: 1, perPage: 24, totalPages: 0 };
  }

  const hasMapPolygon = filters.mapPolygon != null && filters.mapPolygon.length >= 3;
  if (hasMapPolygon) {
    return sparkSearchWithMapPolygon(cfg, filters);
  }

  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(SPARK_PROPERTY_PAGE_SIZE, Math.max(1, filters.perPage ?? 24));
  const skip = (page - 1) * perPage;

  const baseQuery: Record<string, string> = {
    $filter: buildFilter(filters),
    $select: SELECT_GRID,
    $top: String(perPage),
    $skip: String(skip),
    $orderby: orderByClause(filters.sort),
  };

  function totalFromResponse(
    data: ODataValueResponse<Record<string, unknown>>,
    rowsLen: number,
  ): number {
    const c = data["@odata.count"];
    if (typeof c === "number") return c;
    if (rowsLen < perPage) return skip + rowsLen;
    return skip + rowsLen + perPage;
  }

  try {
    const withCount = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
      ...baseQuery,
      $count: "true",
    });
    const rows = withCount.value ?? [];
    let listings = rows.map((row) => rowToUnified(row));
    listings = await enrichListingsPageForMapPins(listings, undefined);
    const total = totalFromResponse(withCount, rows.length);
    const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
    return { listings, total, page, perPage, totalPages };
  } catch (e1) {
    console.warn("sparkSearchWithFilters: $count request failed, retrying without $count", e1);
    try {
      const data = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, baseQuery);
      const rows = data.value ?? [];
      let listings = rows.map((row) => rowToUnified(row));
      listings = await enrichListingsPageForMapPins(listings, undefined);
      const total = totalFromResponse(data, rows.length);
      const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
      return { listings, total, page, perPage, totalPages };
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      console.error("sparkSearchWithFilters", msg, e2);
      return { listings: [], total: 0, page, perPage, totalPages: 0 };
    }
  }
}

/**
 * Cross-feed merge helper — fetches up to `take` rows + a total count.
 * Skips per-pin geocode enrichment (the merged page enriches at the end).
 */
export async function sparkFetchTopUnifiedListings(
  filters: ListingFilters,
  take: number,
): Promise<{ rows: UnifiedListing[]; total: number }> {
  const cfg = getSparkODataConfig();
  if (!cfg) return { rows: [], total: 0 };

  const hasMapPolygon = filters.mapPolygon != null && filters.mapPolygon.length >= 3;
  if (hasMapPolygon) {
    const result = await sparkSearchWithMapPolygon(cfg, { ...filters, page: 1, perPage: Math.min(200, take) });
    return { rows: result.listings, total: result.total };
  }

  const filter = buildFilter(filters);
  const orderBy = orderByClause(filters.sort);

  let total = 0;
  let rows: Record<string, unknown>[] = [];

  try {
    const firstPage = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
      $filter: filter,
      $select: SELECT_GRID,
      $top: String(Math.min(SPARK_PROPERTY_PAGE_SIZE, Math.max(1, take))),
      $skip: "0",
      $orderby: orderBy,
      $count: "true",
    });
    rows = firstPage.value ?? [];
    total = typeof firstPage["@odata.count"] === "number" ? firstPage["@odata.count"] : rows.length;
  } catch (e1) {
    try {
      const firstPage = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
        $filter: filter,
        $select: SELECT_GRID,
        $top: String(Math.min(SPARK_PROPERTY_PAGE_SIZE, Math.max(1, take))),
        $skip: "0",
        $orderby: orderBy,
      });
      rows = firstPage.value ?? [];
      total = rows.length;
    } catch (e2) {
      console.error("sparkFetchTopUnifiedListings", e2);
      return { rows: [], total: 0 };
    }
    void e1;
  }

  // Fan out remaining $skip pages in parallel — sequential pagination across 5-15 pages
  // dominated latency. Parallel keeps deeper fetches under ~1.5s for typical queries.
  if (rows.length === SPARK_PROPERTY_PAGE_SIZE && total > rows.length && rows.length < take) {
    const target = Math.min(take, total);
    const remaining = target - rows.length;
    const numExtraPages = Math.ceil(remaining / SPARK_PROPERTY_PAGE_SIZE);
    const skips: number[] = [];
    for (let i = 1; i <= numExtraPages; i++) skips.push(i * SPARK_PROPERTY_PAGE_SIZE);

    const settled = await Promise.allSettled(
      skips.map((skip) =>
        sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
          $filter: filter,
          $select: SELECT_GRID,
          $top: String(Math.min(SPARK_PROPERTY_PAGE_SIZE, target - skip)),
          $skip: String(skip),
          $orderby: orderBy,
        }),
      ),
    );

    for (const s of settled) {
      if (s.status === "fulfilled") {
        rows.push(...(s.value.value ?? []));
      } else {
        console.warn("sparkFetchTopUnifiedListings: parallel page failed", s.reason);
      }
    }
  }

  return { rows: rows.slice(0, take).map((row) => rowToUnified(row)), total };
}

async function suggestQuery(
  cfg: SparkODataConfig,
  filterExtra: string,
  top: number,
): Promise<Record<string, unknown>[]> {
  const query: Record<string, string> = {
    $filter: `${ACTIVE} and (${filterExtra})`,
    $top: String(top),
    $select: "City,StateOrProvince,PostalCode,UnparsedAddress,StreetNumber,StreetName,ListingKey",
  };
  try {
    const data = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, query);
    return data.value ?? [];
  } catch {
    return [];
  }
}

function buildAddressLine(row: Record<string, unknown>): string {
  const c = bridgePropertyToCoreFields(row);
  return c.address_line;
}

export async function sparkGetSearchSuggestions(raw: string): Promise<SearchSuggestion[]> {
  const cfg = getSparkODataConfig();
  if (!cfg) return [];

  const rawClean = raw.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
  const q = rawClean.toLowerCase();
  if (q.length < 2) return [];

  const esc = escapeODataString(q);
  const zipish = /^[\d-]+$/.test(q.replace(/\s/g, ""));
  const cityState = parseCityStateSearchQuery(rawClean);

  const cityFilter = cityState
    ? `contains(tolower(City), '${escapeODataString(cityState.city.toLowerCase())}') and ${stateOrProvinceODataClause(cityState.state)}`
    : `contains(tolower(City), '${esc}')`;

  const addrFilter = cityState
    ? `(contains(tolower(UnparsedAddress), '${escapeODataString(cityState.city.toLowerCase())}') and ${stateOrProvinceODataClause(cityState.state)})`
    : `contains(tolower(UnparsedAddress), '${esc}')`;

  const [cityRows, zipRows, addrRows] = await Promise.all([
    suggestQuery(cfg, cityFilter, 28),
    zipish
      ? suggestQuery(cfg, `startswith(PostalCode, '${escapeODataString(q.replace(/\s/g, ""))}')`, 24)
      : suggestQuery(cfg, `contains(PostalCode, '${esc}')`, 20),
    suggestQuery(cfg, addrFilter, 14),
  ]);

  const out: SearchSuggestion[] = [];
  const seenCity = new Set<string>();
  const seenZip = new Set<string>();
  const seenAddr = new Set<string>();

  const addCity = (city: string, state: string) => {
    const c = city?.trim();
    const s = (state ?? "GA").trim();
    if (!c) return;
    const key = `${c.toLowerCase()}|${s.toLowerCase()}`;
    if (seenCity.has(key)) return;
    seenCity.add(key);
    out.push({
      id: `city-${key}`,
      type: "city",
      label: `${c}, ${s}`,
      subtitle: "City",
      value: `${c}, ${s}`,
    });
  };

  const addZip = (zip: string, city: string, state: string) => {
    const z = zip?.trim();
    if (!z) return;
    const key = z.toLowerCase();
    if (seenZip.has(key)) return;
    seenZip.add(key);
    const place = [city, state].filter(Boolean).join(", ");
    out.push({
      id: `zip-${key}`,
      type: "zip",
      label: z,
      subtitle: place ? `ZIP · ${place}` : "ZIP code",
      value: z,
    });
  };

  const addAddr = (line: string, city: string, state: string, zip: string) => {
    const a = line?.trim();
    if (!a) return;
    const tail = [city, state, zip].filter(Boolean).join(", ");
    const key = `${a.toLowerCase()}|${tail.toLowerCase()}`;
    if (seenAddr.has(key)) return;
    seenAddr.add(key);
    out.push({
      id: `addr-${key.slice(0, 96)}`,
      type: "address",
      label: a,
      subtitle: tail || "Address",
      value: tail ? `${a}, ${tail}` : a,
    });
  };

  for (const row of cityRows) {
    addCity(String(row.City ?? ""), String(row.StateOrProvince ?? ""));
  }
  for (const row of zipRows) {
    addZip(String(row.PostalCode ?? ""), String(row.City ?? ""), String(row.StateOrProvince ?? ""));
  }
  for (const row of addrRows) {
    const line = buildAddressLine(row);
    addAddr(line, String(row.City ?? ""), String(row.StateOrProvince ?? ""), String(row.PostalCode ?? ""));
  }

  const cities = out.filter((s) => s.type === "city");
  const zips = out.filter((s) => s.type === "zip");
  const addrs = out.filter((s) => s.type === "address");
  return [...cities.slice(0, 6), ...zips.slice(0, 4), ...addrs.slice(0, 5)].slice(0, 12);
}

async function enrichPropertyRowWithRemarksIfNeeded(
  cfg: SparkODataConfig,
  filter: string,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (bridgeRowHasRemarkFields(row)) return row;
  const settled = await Promise.allSettled(
    REMARK_SUPPLEMENT_SELECTS.map(($select) =>
      sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
        $filter: filter,
        $select,
        $top: "1",
      }),
    ),
  );
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    const extra = r.value.value?.[0];
    if (!extra) continue;
    const merged = { ...row, ...extra };
    if (bridgeRowHasRemarkFields(merged)) return merged;
  }
  return row;
}

export async function sparkGetMlsListingById(mlsId: string): Promise<MlsListingRow | null> {
  const cfg = getSparkODataConfig();
  if (!cfg) return null;
  const client: SparkODataConfig = cfg;

  const id = mlsId.trim();
  if (!id) return null;
  const esc = escapeODataString(id);

  async function fetchRow(filter: string, select: string): Promise<Record<string, unknown> | null> {
    const data = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(client, {
      $filter: filter,
      $select: select,
      $top: "1",
    });
    return data.value?.[0] ?? null;
  }

  async function finalize(row: Record<string, unknown>, filter: string): Promise<MlsListingRow> {
    const enriched = await enrichPropertyRowWithRemarksIfNeeded(client, filter, row);
    const listingKey = String(enriched.ListingKey ?? "").trim();
    const listingId = String(enriched.ListingId ?? "").trim();
    let mediaUrls: string[] = [];
    if (listingKey || listingId) {
      try {
        mediaUrls = await fetchSparkMediaUrlsForListing(
          client,
          listingKey || listingId,
          listingId || listingKey,
        );
      } catch (e) {
        console.warn("sparkGetMlsListingById: media fetch failed (page still loads)", e);
      }
    }
    const mapOpts: BridgePropertyMapOptions =
      mediaUrls.length > 0 ? { supplementalImageUrls: mediaUrls } : {};
    return rowToMlsListingRow(enriched, mapOpts);
  }

  for (const filter of listingIdFilterVariants(id, esc)) {
    for (const select of detailSelectCandidates()) {
      try {
        const row = await fetchRow(filter, select);
        if (row) return await finalize(row, filter);
      } catch (e) {
        console.warn(
          `sparkGetMlsListingById: attempt failed filter=${filter.slice(0, 100)}… selectFields=${select.split(",").length}`,
          e,
        );
      }
    }
  }

  return null;
}

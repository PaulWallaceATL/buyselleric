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
  extractMediaUrls,
  type BridgePropertyMapOptions,
} from "@/lib/bridge-odata";
import { enrichListingsWithPhotonGeocode } from "@/lib/geocode-listing-address";
import { gaZip5CodesInsidePolygon } from "@/lib/ga-zip-centroids";
import { applyZipCentroidPinCoords, listingMatchesDrawnPolygon } from "@/lib/map-pin-coords";
import { parseCityStateSearchQuery } from "@/lib/listing-query-text";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";
import {
  amenitiesFromListingFilters,
  buildAmenityODataClauses,
} from "@/lib/listing-amenities";
import { enabledAmenityKeys } from "@/lib/amenity-feed-capabilities";
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

/**
 * Active listings filter. Spark's RESO Web API silently treats `tolower()` as
 * a no-op (it matches every row), so we can't use it for case-insensitive
 * filtering. Instead we OR the obvious exact-case variants — Mid-Georgia MLS
 * stores values as title-case 'Active', but defending against 'active' /
 * 'ACTIVE' is cheap.
 */
const ACTIVE =
  "((StandardStatus eq 'Active') or (StandardStatus eq 'active') or (StandardStatus eq 'ACTIVE') or (MlsStatus eq 'Active') or (MlsStatus eq 'active') or (MlsStatus eq 'ACTIVE'))";

/**
 * Spark RESO Web API does not reliably support `contains()` or function-chained
 * filters like `contains(tolower(City), 'macon')` — they silently return zero
 * rows even when matching data exists (verified against Mid-Georgia MLS feed:
 * `City eq 'Macon'` → 24,164 rows; `contains(tolower(City), 'macon')` → 0).
 * For Spark we use exact-match `eq` filters with a small set of case variants.
 */
function titleCase(s: string): string {
  return s
    .split(/(\s+|-)/)
    .map((part) => (part.match(/^[A-Za-z]+$/) ? part[0]!.toUpperCase() + part.slice(1).toLowerCase() : part))
    .join("");
}

function stateOrProvinceODataClause(stateUser: string): string {
  const s = stateUser.trim();
  if (!s) return "(true)";
  const upper = s.toUpperCase();
  const parts: string[] = [];
  if (/^[A-Za-z]{2}$/.test(s) && US_STATE_ABBR_TO_NAME[upper]) {
    parts.push(`StateOrProvince eq '${escapeODataString(upper)}'`);
    parts.push(`StateOrProvince eq '${escapeODataString(US_STATE_ABBR_TO_NAME[upper])}'`);
  } else {
    parts.push(`StateOrProvince eq '${escapeODataString(titleCase(s))}'`);
    for (const [abbr, name] of Object.entries(US_STATE_ABBR_TO_NAME)) {
      if (name.toLowerCase() === s.toLowerCase()) {
        parts.push(`StateOrProvince eq '${escapeODataString(abbr.toUpperCase())}'`);
        break;
      }
    }
  }
  return `(${parts.join(" or ")})`;
}

/** Spark city filter: exact-match variants since `contains()` returns 0 rows. */
function cityODataClause(cityUser: string): string {
  const s = cityUser.trim();
  if (!s) return "(true)";
  const variants = new Set<string>();
  variants.add(titleCase(s));
  variants.add(s);
  variants.add(s.toUpperCase());
  variants.add(s.toLowerCase());
  return `(${[...variants].map((v) => `City eq '${escapeODataString(v)}'`).join(" or ")})`;
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
  if (c.listing_agent_phone) base.listing_agent_phone = c.listing_agent_phone;
  if (c.listing_office) base.listing_office = c.listing_office;
  if (c.listing_office_phone) base.listing_office_phone = c.listing_office_phone;
  if (c.description?.trim()) base.matchText = c.description.trim();
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
    listing_agent_phone: c.listing_agent_phone,
    listing_office: c.listing_office,
    listing_office_phone: c.listing_office_phone,
    raw_data: row,
    synced_at: now,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Search/grid: fields needed for cards + map + filters.
 *
 * IMPORTANT: Spark RESO Web API treats `Media` as a navigation property, not
 * a scalar field — putting it in `$select` returns HTTP 400
 * (`$select contains non-matching element: Media`). Photos for the grid
 * load inline via `$expand=Media` instead (see SPARK_EXPAND below).
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
  "ListAgentPreferredPhone",
  "ListAgentDirectPhone",
  "ListAgentCellPhone",
  "ListOfficeName",
  "ListOfficePhone",
  "ModificationTimestamp",
].join(",");

/** Default `$expand` for Spark Property queries — pulls inline photos with the row. */
const SPARK_EXPAND = "Media";

/** Helper: returns the standard $select + $expand pair for any Spark Property query. */
function sparkSelectExpand(filters?: ListingFilters): { $select: string; $expand: string } {
  const select = filters?.includeRemarksForMatch
    ? `${SELECT_GRID},PublicRemarks,ArchitecturalStyle,InteriorFeatures,ExteriorFeatures,PoolPrivateYN,GarageSpaces`
    : SELECT_GRID;
  return { $select: select, $expand: SPARK_EXPAND };
}

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
    // Spark doesn't support contains(tolower(...)) — fall back to exact eq variants.
    const raw = filters.propertyType.trim();
    const variants = new Set([titleCase(raw), raw, raw.toUpperCase(), raw.toLowerCase()]);
    parts.push(
      `(${[...variants].map((v) => `PropertyType eq '${escapeODataString(v)}'`).join(" or ")})`,
    );
  }

  const amenityParts = buildAmenityODataClauses(
    amenitiesFromListingFilters(filters),
    "spark",
    enabledAmenityKeys("spark"),
  );
  parts.push(...amenityParts);

  const q = filters.q?.trim();
  if (q) {
    const cityState = parseCityStateSearchQuery(q);
    if (cityState && options?.mapPolygonWide) {
      parts.push(stateOrProvinceODataClause(cityState.state));
    } else if (cityState) {
      parts.push(cityODataClause(cityState.city));
      parts.push(stateOrProvinceODataClause(cityState.state));
    } else {
      const trimmed = q.replace(/\s/g, "");
      const zipish = /^[\d-]+$/.test(trimmed);
      if (zipish) {
        // Exact + startswith both supported on Spark.
        parts.push(
          `(PostalCode eq '${escapeODataString(trimmed)}' or startswith(PostalCode, '${escapeODataString(trimmed)}'))`,
        );
      } else {
        // Plain text without "City, ST" parse — try exact city across common case variants.
        parts.push(cityODataClause(q));
      }
    }
  }

  const poly = filters.mapPolygon;
  if (poly && poly.length >= 3) {
    const zips = gaZip5CodesInsidePolygon(poly).slice(0, 80);
    if (zips.length > 0) {
      const zipOr = zips
        .map((z) => {
          const esc = escapeODataString(z);
          return `(PostalCode eq '${esc}' or startswith(PostalCode, '${esc}'))`;
        })
        .join(" or ");
      parts.push(`(${zipOr})`);
    } else {
      const lats = poly.map((p) => p.lat);
      const lngs = poly.map((p) => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      parts.push(`Latitude ge ${minLat} and Latitude le ${maxLat}`);
      parts.push(`Longitude ge ${minLng} and Longitude le ${maxLng}`);
    }
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
  return unified.filter((u) => listingMatchesDrawnPolygon(u, poly));
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
      $expand: SPARK_EXPAND,
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
  const perPage = Math.min(
    MAP_POLYGON_MAX_ROWS_PRIMARY,
    Math.max(1, filters.perPage ?? 24),
  );
  const skip = (page - 1) * perPage;

  const select = SELECT_GRID;
  const orderBy = orderByClause(filters.sort);
  const primaryFilter = buildFilter(filters);
  const poly = filters.mapPolygon;
  const postalPrimary =
    !!poly && poly.length >= 3 && gaZip5CodesInsidePolygon(poly).length > 0;
  let primaryFailed = false;

  let rows: Record<string, unknown>[] = [];
  let wideFetch = false;

  try {
    rows = await fetchPropertyRows(cfg, primaryFilter, select, orderBy, MAP_POLYGON_MAX_ROWS_PRIMARY);
  } catch (e1) {
    console.warn("sparkSearchWithMapPolygon: primary OData failed; trying widened search", e1);
    rows = [];
    primaryFailed = true;
  }

  let unified = rows.map((row) => rowToUnified(row));
  if (poly && poly.length >= 3) {
    unified = filterUnifiedListingsToDrawnPolygon(unified, poly);
  }

  const needWide = poly && poly.length >= 3 && unified.length === 0;
  if (needWide) {
    try {
      const wideFilter =
        postalPrimary && !primaryFailed
          ? buildFilter(omitMapPolygon(filters), { mapPolygonWide: true })
          : buildFilter(
              postalPrimary ? filters : omitMapPolygon(filters),
              { mapPolygonWide: true },
            );
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
    ...sparkSelectExpand(),
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
 * Cross-feed merge helper — fetches a single OData page by ($skip, $top) plus
 * the upstream total via $count. Used by the multi-feed deep-pagination path
 * so each feed contributes one page worth of rows; the caller merges, sorts
 * and slices into the final page.
 */
export async function sparkFetchUnifiedPage(
  filters: ListingFilters,
  options: { skip: number; take: number },
): Promise<{ rows: UnifiedListing[]; total: number }> {
  const cfg = getSparkODataConfig();
  if (!cfg) return { rows: [], total: 0 };

  const hasMapPolygon = filters.mapPolygon != null && filters.mapPolygon.length >= 3;
  if (hasMapPolygon) {
    const result = await sparkSearchWithMapPolygon(cfg, {
      ...filters,
      page: 1,
      perPage: Math.min(MAP_POLYGON_MAX_ROWS_PRIMARY, Math.max(1, options.take)),
    });
    return { rows: result.listings, total: result.total };
  }

  const filter = buildFilter(filters);
  const orderBy = orderByClause(filters.sort);
  const top = Math.min(SPARK_PROPERTY_PAGE_SIZE, Math.max(1, options.take));
  const skip = Math.max(0, options.skip);

  try {
    const data = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
      $filter: filter,
      ...sparkSelectExpand(),
      $top: String(top),
      $skip: String(skip),
      $orderby: orderBy,
      $count: "true",
    });
    const raw = data.value ?? [];
    const total =
      typeof data["@odata.count"] === "number"
        ? data["@odata.count"]
        : skip + raw.length + (raw.length === top ? top : 0);
    return { rows: raw.map((row) => rowToUnified(row)), total };
  } catch (e1) {
    try {
      const data = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
        $filter: filter,
        ...sparkSelectExpand(),
        $top: String(top),
        $skip: String(skip),
        $orderby: orderBy,
      });
      const raw = data.value ?? [];
      const total = skip + raw.length + (raw.length === top ? top : 0);
      return { rows: raw.map((row) => rowToUnified(row)), total };
    } catch (e2) {
      console.error("sparkFetchUnifiedPage", e2);
      void e1;
      return { rows: [], total: 0 };
    }
  }
}

/** Lightweight skip=0 count probe for multi-feed pagination totals. */
export async function sparkProbeExactTotal(filters: ListingFilters): Promise<number> {
  const cfg = getSparkODataConfig();
  if (!cfg) return 0;

  const hasMapPolygon = filters.mapPolygon != null && filters.mapPolygon.length >= 3;
  if (hasMapPolygon) {
    const result = await sparkSearchWithMapPolygon(cfg, { ...filters, page: 1, perPage: 1 });
    return result.total;
  }

  const filter = buildFilter(filters);

  try {
    const data = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
      $filter: filter,
      $select: "ListingKey",
      $top: "1",
      $skip: "0",
      $count: "true",
    });
    if (typeof data["@odata.count"] === "number") return data["@odata.count"];
    const batch = data.value ?? [];
    if (batch.length === 0) return 0;
  } catch (e) {
    console.warn("sparkProbeExactTotal", e);
  }

  const window = await sparkFetchUnifiedPage(filters, { skip: 0, take: SPARK_PROPERTY_PAGE_SIZE });
  if (window.rows.length === 0) return 0;
  if (window.total > window.rows.length) return window.total;
  if (window.rows.length < SPARK_PROPERTY_PAGE_SIZE) return window.rows.length;
  return window.total > 0 ? window.total : window.rows.length;
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
    const result = await sparkSearchWithMapPolygon(cfg, {
      ...filters,
      page: 1,
      perPage: Math.min(MAP_POLYGON_MAX_ROWS_PRIMARY, Math.max(1, take)),
    });
    return { rows: result.listings, total: result.total };
  }

  const filter = buildFilter(filters);
  const orderBy = orderByClause(filters.sort);
  let selectExpand = sparkSelectExpand(filters);

  let total = 0;
  let rows: Record<string, unknown>[] = [];

  try {
    const firstPage = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
      $filter: filter,
      ...selectExpand,
      $top: String(Math.min(SPARK_PROPERTY_PAGE_SIZE, Math.max(1, take))),
      $skip: "0",
      $orderby: orderBy,
      $count: "true",
    });
    rows = firstPage.value ?? [];
    total = typeof firstPage["@odata.count"] === "number" ? firstPage["@odata.count"] : rows.length;
  } catch (e1) {
    if (filters.includeRemarksForMatch) {
      selectExpand = sparkSelectExpand({ ...filters, includeRemarksForMatch: false });
    }
    try {
      const firstPage = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
        $filter: filter,
        ...selectExpand,
        $top: String(Math.min(SPARK_PROPERTY_PAGE_SIZE, Math.max(1, take))),
        $skip: "0",
        $orderby: orderBy,
      });
      rows = firstPage.value ?? [];
      total = rows.length;
    } catch (e2) {
      console.error("sparkFetchTopUnifiedListings", e2);
      void e1;
      return { rows: [], total: 0 };
    }
    void e1;
  }

  while (rows.length === SPARK_PROPERTY_PAGE_SIZE && total > rows.length && rows.length < take) {
    const target = Math.min(take, total);
    const skip = rows.length;
    const nextTop = Math.min(SPARK_PROPERTY_PAGE_SIZE, target - skip);
    try {
      const data = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(cfg, {
        $filter: filter,
        ...selectExpand,
        $top: String(nextTop),
        $skip: String(skip),
        $orderby: orderBy,
      });
      const batch = data.value ?? [];
      rows.push(...batch);
      if (batch.length === 0 || batch.length < nextTop) break;
    } catch (e) {
      console.warn("sparkFetchTopUnifiedListings: sequential page failed", e);
      break;
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
    $select: "City,StateOrProvince,PostalCode,UnparsedAddress,StreetNumber,StreetName,ListingKey,ListingId",
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

  const trimmed = q.replace(/\s/g, "");
  const zipish = /^[\d-]+$/.test(trimmed);
  const cityState = parseCityStateSearchQuery(rawClean);

  const cityFilter = cityState
    ? `${cityODataClause(cityState.city)} and ${stateOrProvinceODataClause(cityState.state)}`
    : `startswith(City, '${escapeODataString(titleCase(rawClean))}')`;

  const addrFilter = cityState
    ? `startswith(UnparsedAddress, '${escapeODataString(titleCase(cityState.city))}') and ${stateOrProvinceODataClause(cityState.state)}`
    : `startswith(UnparsedAddress, '${escapeODataString(titleCase(rawClean))}')`;

  const [cityRows, zipRows, addrRows] = await Promise.all([
    suggestQuery(cfg, cityFilter, 28),
    zipish
      ? suggestQuery(cfg, `startswith(PostalCode, '${escapeODataString(trimmed)}')`, 24)
      : suggestQuery(cfg, `startswith(PostalCode, '${escapeODataString(trimmed)}')`, 20),
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

  const addAddr = (line: string, city: string, state: string, zip: string, mlsId: string) => {
    const a = line?.trim();
    if (!a) return;
    const tail = [city, state, zip].filter(Boolean).join(", ");
    const key = `${a.toLowerCase()}|${tail.toLowerCase()}`;
    if (seenAddr.has(key)) return;
    seenAddr.add(key);
    const sug: SearchSuggestion = {
      id: `addr-${key.slice(0, 96)}`,
      type: "address",
      label: a,
      subtitle: tail || "Address",
      value: tail ? `${a}, ${tail}` : a,
    };
    const id = mlsId.trim();
    if (id) sug.href = `/listings/mls/${encodeURIComponent(id)}`;
    out.push(sug);
  };

  for (const row of cityRows) {
    addCity(String(row.City ?? ""), String(row.StateOrProvince ?? ""));
  }
  for (const row of zipRows) {
    addZip(String(row.PostalCode ?? ""), String(row.City ?? ""), String(row.StateOrProvince ?? ""));
  }
  for (const row of addrRows) {
    const line = buildAddressLine(row);
    // Spark detail page resolves either ListingId or ListingKey via sparkGetMlsListingById's
    // listingIdFilterVariants — prefer ListingId since it's the user-facing MLS number.
    const mlsId = String(row.ListingId ?? row.ListingKey ?? "");
    addAddr(line, String(row.City ?? ""), String(row.StateOrProvince ?? ""), String(row.PostalCode ?? ""), mlsId);
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

export type MlsDetailFetchOptions = {
  /**
   * When true, wait for Media-entity URLs.
   * Default false: paint from Property + expanded Media as soon as possible.
   */
  fullEnrich?: boolean;
};

export async function sparkGetMlsListingById(
  mlsId: string,
  options?: MlsDetailFetchOptions,
): Promise<MlsListingRow | null> {
  const cfg = getSparkODataConfig();
  if (!cfg) return null;
  const client: SparkODataConfig = cfg;
  const fullEnrich = options?.fullEnrich === true;

  const id = mlsId.trim();
  if (!id) return null;
  const esc = escapeODataString(id);
  const DETAIL_REVALIDATE = 60;

  async function fetchRow(filter: string, select: string): Promise<Record<string, unknown> | null> {
    const data = await sparkODataGet<ODataValueResponse<Record<string, unknown>>>(
      client,
      {
        $filter: filter,
        $select: select,
        $expand: SPARK_EXPAND,
        $top: "1",
      },
      { revalidate: DETAIL_REVALIDATE },
    );
    return data.value?.[0] ?? null;
  }

  async function finalize(row: Record<string, unknown>, filter: string): Promise<MlsListingRow> {
    const enriched = await enrichPropertyRowWithRemarksIfNeeded(client, filter, row);
    const listingKey = String(enriched.ListingKey ?? "").trim();
    const listingId = String(enriched.ListingId ?? "").trim();
    const inlinePhotos = extractMediaUrls(enriched.Media);

    // Hot path: $expand=Media already gave photos — return immediately.
    if (!fullEnrich && inlinePhotos.length > 0) {
      return rowToMlsListingRow(enriched);
    }

    let mediaUrls: string[] = [];
    const mediaWaitMs = inlinePhotos.length > 0 ? 2_500 : 6_000;
    if (listingKey || listingId) {
      try {
        mediaUrls = await Promise.race([
          fetchSparkMediaUrlsForListing(
            client,
            listingKey || listingId,
            listingId || listingKey,
          ),
          new Promise<string[]>((resolve) => {
            setTimeout(() => resolve([]), mediaWaitMs);
          }),
        ]);
      } catch (e) {
        console.warn("sparkGetMlsListingById: media fetch failed (page still loads)", e);
      }
    }
    if (mediaUrls.length > 0) {
      const { Media: _drop, ...rest } = enriched;
      return rowToMlsListingRow(rest, { supplementalImageUrls: mediaUrls });
    }
    return rowToMlsListingRow(enriched);
  }

  const filters = listingIdFilterVariants(id, esc);
  const selects = detailSelectCandidates();
  const primaryFilter = filters[0]!;
  const primarySelect = selects[0]!;
  const fallbackFilters = filters.slice(0, 3);
  const fallbackSelects = selects.slice(0, 3);

  try {
    const row = await fetchRow(primaryFilter, primarySelect);
    if (row) return await finalize(row, primaryFilter);
  } catch (e) {
    console.warn(
      `sparkGetMlsListingById: primary attempt failed filter=${primaryFilter.slice(0, 100)}…`,
      e,
    );
  }

  for (const filter of fallbackFilters) {
    for (const select of fallbackSelects) {
      if (filter === primaryFilter && select === primarySelect) continue;
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

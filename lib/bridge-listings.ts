import type { MlsListingRow } from "@/lib/types/db";
import {
  bridgeODataGet,
  bridgePropertyToCoreFields,
  bridgeRowHasRemarkFields,
  escapeODataString,
  fetchBridgeMediaUrlsForListing,
  getBridgeODataConfig,
  type BridgeODataConfig,
  type BridgeODataValueResponse,
  type BridgePropertyMapOptions,
} from "@/lib/bridge-odata";
import { gaZipCentroid, normalizeUsZip5 } from "@/lib/ga-zip-centroids";
import { pointInPolygon } from "@/lib/geo";
import { parseCityStateSearchQuery } from "@/lib/listing-query-text";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";
import type { ListingFilters, PaginatedResult, UnifiedListing } from "@/lib/listings-queries";
import type { SearchSuggestion } from "@/lib/listing-search-suggest";
import { US_STATE_ABBR_TO_NAME } from "@/lib/us-state-names";

/** Active-ish listings; avoids `tolower(null)` edge cases on some feeds. */
const ACTIVE =
  "((StandardStatus eq 'Active') or (tolower(StandardStatus) eq 'active') or (MlsStatus eq 'Active') or (tolower(MlsStatus) eq 'active'))";

/** MLS often stores full state name ("Georgia") while users search "GA" — `contains` fails for that pair. */
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

function buildAddressLine(row: Record<string, unknown>): string {
  const core = bridgePropertyToCoreFields(row);
  return core.address_line;
}

export function isBridgeListingsEnabled(): boolean {
  return getBridgeODataConfig() != null;
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
 * `gamls2` (IDX) rejects several standard RESO fields on $select — omit anything Bridge returns 400 for.
 */
const SELECT_GRID =
  "ListingKey,ListingId,UnparsedAddress,StreetNumber,StreetDirPrefix,StreetName,StreetSuffix,StreetDirSuffix,UnitNumber,City,StateOrProvince,PostalCode,ListPrice,BedroomsTotal,BathroomsTotalInteger,BathroomsFull,BathroomsHalf,BathroomsTotalDecimal,LivingArea,PropertyType,PropertySubType,StandardStatus,MlsStatus,SubdivisionName,Media,ModificationTimestamp";

/** gamls2 IDX rejects these on $select (see Bridge 400). Strip from env overrides too. */
const GAMLS_BLOCKED_SELECT_FIELDS = new Set([
  "Unit",
  "BathroomsTotal",
  "Latitude",
  "Longitude",
  "ListAgentFullName",
  "ListAgent",
  "ListOfficeName",
  "ListOffice",
]);

/** Some feeds block Lat/Lng on $select for generic grid — map polygon search must keep them when allowed. */
const GAMLS_GEO_SELECT_FIELDS = new Set(["Latitude", "Longitude"]);

function sanitizeBridgePropertySelect(
  select: string,
  options?: { allowGeoFieldsInSelect?: boolean },
): string {
  const blocked =
    options?.allowGeoFieldsInSelect === true
      ? new Set([...GAMLS_BLOCKED_SELECT_FIELDS].filter((f) => !GAMLS_GEO_SELECT_FIELDS.has(f)))
      : GAMLS_BLOCKED_SELECT_FIELDS;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of select
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((field) => !blocked.has(field))) {
    if (seen.has(f)) continue;
    seen.add(f);
    out.push(f);
  }
  return out.join(",");
}

/** When detail $select omits remarks (sparse fallback), fetch remark columns alone and merge. */
const REMARK_SUPPLEMENT_SELECTS = [
  "ListingKey,ListingId,PublicRemarks,SupplementalPublicRemarks,PrivateRemarks,InternetRemarks",
  "ListingKey,ListingId,PublicRemarks,InternetRemarks",
  "ListingKey,ListingId,PublicRemarks",
  "ListingId,PublicRemarks",
];

async function enrichPropertyRowWithRemarksIfNeeded(
  client: BridgeODataConfig,
  filter: string,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (bridgeRowHasRemarkFields(row)) return row;
  const selects = [...new Set(REMARK_SUPPLEMENT_SELECTS.map((s) => sanitizeBridgePropertySelect(s)))];
  // Run in parallel so a sparse Property hit does not add four sequential round-trips (feels “stuck”).
  const settled = await Promise.allSettled(
    selects.map(($select) =>
      bridgeODataGet<BridgeODataValueResponse<Record<string, unknown>>>(client, {
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

/**
 * Detail page: same fields as search (including inline `Media` for photos) + remarks.
 * gamls2 often rejects extra RESO columns — add more only via BRIDGE_PROPERTY_SELECT_DETAIL.
 */
const SELECT_DETAIL_SAFE = sanitizeBridgePropertySelect(
  `${SELECT_GRID},PublicRemarks,SupplementalPublicRemarks,PrivateRemarks`,
);

/** Lighter detail if SAFE fails; keep `Media` so gallery can load without a separate Media query. */
const SELECT_DETAIL_SPARSE = sanitizeBridgePropertySelect(
  "ListingKey,ListingId,UnparsedAddress,StreetNumber,StreetDirPrefix,StreetName,StreetSuffix,StreetDirSuffix,UnitNumber,City,StateOrProvince,PostalCode,ListPrice,BedroomsTotal,BathroomsTotalInteger,BathroomsFull,BathroomsHalf,BathroomsTotalDecimal,LivingArea,PropertyType,PropertySubType,StandardStatus,MlsStatus,SubdivisionName,ModificationTimestamp,Media",
);

/** If ModificationTimestamp or subdivision is blocked on $select for some rows. */
const SELECT_DETAIL_MINIMAL = sanitizeBridgePropertySelect(
  "ListingKey,ListingId,UnparsedAddress,StreetNumber,StreetDirPrefix,StreetName,StreetSuffix,StreetDirSuffix,UnitNumber,City,StateOrProvince,PostalCode,ListPrice,BedroomsTotal,BathroomsTotalInteger,BathroomsFull,BathroomsHalf,BathroomsTotalDecimal,LivingArea,PropertyType,PropertySubType,StandardStatus,MlsStatus",
);

const SELECT_DETAIL_MINIMAL_WITH_MEDIA = sanitizeBridgePropertySelect(`${SELECT_DETAIL_MINIMAL},Media`);

function selectDetail(): string {
  const override = process.env.BRIDGE_PROPERTY_SELECT_DETAIL?.trim();
  const raw = override || SELECT_DETAIL_SAFE;
  return sanitizeBridgePropertySelect(raw);
}

/** Ordered $select lists to try for GET-by-id (safest last). */
function detailSelectCandidates(): string[] {
  const primary = selectDetail();
  const uniq = [
    primary,
    SELECT_DETAIL_SAFE,
    SELECT_DETAIL_SPARSE,
    SELECT_DETAIL_MINIMAL_WITH_MEDIA,
    SELECT_DETAIL_MINIMAL,
  ];
  return [...new Set(uniq)];
}

/** ListingId may be typed as integer in OData; try quoted + unquoted + active/no-active. */
function listingIdFilterVariants(rawId: string, esc: string): string[] {
  const quoted = `(ListingId eq '${esc}' or ListingKey eq '${esc}')`;
  const out: string[] = [`${ACTIVE} and ${quoted}`, quoted];
  if (/^\d+$/.test(rawId)) {
    const n = rawId;
    const intish = `(ListingId eq ${n} or ListingKey eq ${n} or ListingKey eq '${esc}')`;
    out.push(`${ACTIVE} and ${intish}`, intish);
  }
  // Some feeds use a string ListingKey that embeds the display MLS number (e.g. prefix + id).
  if (/^\d{6,}$/.test(rawId)) {
    const sub = `(contains(ListingKey, '${esc}'))`;
    out.push(`${ACTIVE} and ${sub}`, sub);
  }
  return [...new Set(out)];
}

type BuildFilterOptions = {
  /**
   * Map draw — pass 2: geography is the polygon; requiring "Atlanta" in City/address drops
   * Woodstock, Canton, Marietta, etc. Keep state (and free-text / ZIP behaviour) only.
   */
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
      // Many feeds leave City blank but repeat locality in UnparsedAddress — match both like the generic branch.
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

function gridSelectForFilters(_filters: ListingFilters): string {
  return sanitizeBridgePropertySelect(SELECT_GRID);
}

/** Map PIP needs coords in the payload; many IDX feeds reject Latitude/Longitude in `$select` (try then fall back). */
function gridSelectForMapPolygonGeoAttempt(): string {
  return sanitizeBridgePropertySelect(`${SELECT_GRID},Latitude,Longitude`, {
    allowGeoFieldsInSelect: true,
  });
}

function isODataCannotSelectLatLngError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /cannot select/i.test(msg) && (/latitude/i.test(msg) || /longitude/i.test(msg));
}

/** GAMLS / many Bridge IDX feeds reject `$top` above 200 — page with `$skip` instead. */
const BRIDGE_PROPERTY_PAGE_SIZE = Math.min(
  200,
  Math.max(1, Number.parseInt(process.env.BRIDGE_ODATA_MAX_TOP?.trim() ?? "200", 10) || 200),
);

/**
 * Max rows to merge in memory (each Bridge page is ≤200). Keep low to avoid Vercel serverless timeouts
 * when the IDX needs a Lat/Lng-$select retry and multiple $skip pages.
 */
const MAP_POLYGON_MAX_ROWS_PRIMARY = Math.min(
  2_000,
  Math.max(200, Number.parseInt(process.env.MAP_POLYGON_MAX_ODATA_ROWS?.trim() ?? "1600", 10) || 1600),
);

/** Wider OData merge for map draw pass 2 — geography is the polygon, not the anchor city name. */
const MAP_POLYGON_MAX_ROWS_WIDE = Math.min(
  4_000,
  Math.max(400, Number.parseInt(process.env.MAP_POLYGON_MAX_ODATA_ROWS_WIDE?.trim() ?? "2400", 10) || 2400),
);

function omitMapPolygon(filters: ListingFilters): ListingFilters {
  const { mapPolygon: _drop, ...rest } = filters;
  return rest;
}

/**
 * Keep listings inside the drawn polygon: exact coords when present, else ZIP centroid vs polygon.
 * We do not keep "unknown location" rows — the MLS bbox is a rectangle, not the freehand outline.
 */
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

/** Repeated OData pages with `$top` ≤ BRIDGE_PROPERTY_PAGE_SIZE until `maxRows` or no more data. */
async function fetchPropertyRowsForPolygon(
  cfg: BridgeODataConfig,
  filter: string,
  select: string,
  orderBy: string,
  maxRows: number,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const pageSize = BRIDGE_PROPERTY_PAGE_SIZE;
  let odataSkip = 0;

  while (out.length < maxRows) {
    const take = Math.min(pageSize, maxRows - out.length);
    const data = await bridgeODataGet<BridgeODataValueResponse<Record<string, unknown>>>(cfg, {
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

/**
 * Many IDX feeds reject Latitude/Longitude in `$select` (400). Default skips that attempt so map search
 * does one OData pass (faster, avoids “stuck” double-fetch). Set BRIDGE_MAP_POLYGON_TRY_GEO_SELECT=true
 * if your feed allows geo fields on Property search.
 */
async function fetchMapPolygonRowsWithSelectFallback(
  cfg: BridgeODataConfig,
  filter: string,
  selectGeo: string,
  selectNoGeo: string,
  orderBy: string,
  maxRows: number,
): Promise<{ rows: Record<string, unknown>[] }> {
  const tryGeoFirst = process.env.BRIDGE_MAP_POLYGON_TRY_GEO_SELECT?.trim() === "true";
  if (!tryGeoFirst) {
    const rows = await fetchPropertyRowsForPolygon(cfg, filter, selectNoGeo, orderBy, maxRows);
    return { rows };
  }
  try {
    const rows = await fetchPropertyRowsForPolygon(cfg, filter, selectGeo, orderBy, maxRows);
    return { rows };
  } catch (e) {
    if (!isODataCannotSelectLatLngError(e)) throw e;
    const rows = await fetchPropertyRowsForPolygon(cfg, filter, selectNoGeo, orderBy, maxRows);
    return { rows };
  }
}

/** Map polygon: OData bbox on Lat/Lng first; in-memory PIP / ZIP centroid; widen query if bbox is empty or strict filter yields no rows. */
async function bridgeSearchWithMapPolygon(
  cfg: BridgeODataConfig,
  filters: ListingFilters,
): Promise<PaginatedResult> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(200, Math.max(1, filters.perPage ?? 24));
  const skip = (page - 1) * perPage;

  const selectGeo = gridSelectForMapPolygonGeoAttempt();
  const selectNoGeo = gridSelectForFilters(filters);
  const orderBy = orderByClause(filters.sort);

  const primaryFilter = buildFilter(filters);
  const poly = filters.mapPolygon;

  let rows: Record<string, unknown>[] = [];
  let wideFetch = false;

  try {
    const r = await fetchMapPolygonRowsWithSelectFallback(
      cfg,
      primaryFilter,
      selectGeo,
      selectNoGeo,
      orderBy,
      MAP_POLYGON_MAX_ROWS_PRIMARY,
    );
    rows = r.rows;
  } catch (e1) {
    // Some IDX feeds reject Latitude/Longitude in $filter (or return 400 for other reasons).
    // Do not return yet — widened search without the map bbox still respects q + filters + in-memory polygon.
    console.warn("bridgeSearchWithMapPolygon: primary OData failed; trying widened search without map bbox", e1);
    rows = [];
  }

  let unified = rows.map((row) => rowToUnified(row));
  if (poly && poly.length >= 3) {
    unified = filterUnifiedListingsToDrawnPolygon(unified, poly);
  }

  const needWide =
    poly &&
    poly.length >= 3 &&
    unified.length === 0;

  if (needWide) {
    try {
      const wideFilter = buildFilter(omitMapPolygon(filters), { mapPolygonWide: true });
      const orderByWide = "ModificationTimestamp desc";
      try {
        rows = await fetchPropertyRowsForPolygon(
          cfg,
          wideFilter,
          selectNoGeo,
          orderByWide,
          MAP_POLYGON_MAX_ROWS_WIDE,
        );
      } catch (eTs) {
        console.warn(
          "bridgeSearchWithMapPolygon: wide query $orderby ModificationTimestamp failed; retrying with list sort",
          eTs,
        );
        rows = await fetchPropertyRowsForPolygon(
          cfg,
          wideFilter,
          selectNoGeo,
          orderBy,
          MAP_POLYGON_MAX_ROWS_WIDE,
        );
      }
      wideFetch = true;
      unified = rows.map((row) => rowToUnified(row));
      unified = filterUnifiedListingsToDrawnPolygon(unified, poly);
    } catch (e2) {
      console.warn("bridgeSearchWithMapPolygon: widened OData request failed", e2);
      return { listings: [], total: 0, page, perPage, totalPages: 0 };
    }
  }
  const total = unified.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
  const listings = unified.slice(skip, skip + perPage);
  return {
    listings,
    total,
    page,
    perPage,
    totalPages,
    mapPolygonWideFetch: wideFetch || undefined,
  };
}

export async function bridgeSearchWithFilters(filters: ListingFilters): Promise<PaginatedResult> {
  const cfg = getBridgeODataConfig();
  if (!cfg) {
    return { listings: [], total: 0, page: 1, perPage: 24, totalPages: 0 };
  }

  const hasMapPolygon = filters.mapPolygon != null && filters.mapPolygon.length >= 3;

  if (hasMapPolygon) {
    return bridgeSearchWithMapPolygon(cfg, filters);
  }

  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(200, Math.max(1, filters.perPage ?? 24));
  const skip = (page - 1) * perPage;

  const baseQuery: Record<string, string> = {
    $filter: buildFilter(filters),
    $select: gridSelectForFilters(filters),
    $top: String(perPage),
    $skip: String(skip),
    $orderby: orderByClause(filters.sort),
  };

  function totalFromResponse(
    data: BridgeODataValueResponse<Record<string, unknown>>,
    rowsLen: number,
  ): number {
    const c = data["@odata.count"];
    if (typeof c === "number") return c;
    if (rowsLen < perPage) return skip + rowsLen;
    return skip + rowsLen + perPage;
  }

  try {
    const withCount = await bridgeODataGet<BridgeODataValueResponse<Record<string, unknown>>>(cfg, {
      ...baseQuery,
      $count: "true",
    });
    const rows = withCount.value ?? [];
    const listings = rows.map((row) => rowToUnified(row));
    const total = totalFromResponse(withCount, rows.length);
    const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
    return {
      listings,
      total,
      page,
      perPage,
      totalPages,
    };
  } catch (e1) {
    console.warn("bridgeSearchWithFilters: $count request failed, retrying without $count", e1);
    try {
      const data = await bridgeODataGet<BridgeODataValueResponse<Record<string, unknown>>>(cfg, baseQuery);
      const rows = data.value ?? [];
      const listings = rows.map((row) => rowToUnified(row));
      const total = totalFromResponse(data, rows.length);
      const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
      return {
        listings,
        total,
        page,
        perPage,
        totalPages,
      };
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      console.error("bridgeSearchWithFilters", msg, e2);
      return { listings: [], total: 0, page, perPage, totalPages: 0 };
    }
  }
}

async function suggestQuery(cfg: BridgeODataConfig, filterExtra: string, top: number): Promise<Record<string, unknown>[]> {
  const query: Record<string, string> = {
    $filter: `${ACTIVE} and (${filterExtra})`,
    $top: String(top),
    $select: "City,StateOrProvince,PostalCode,UnparsedAddress,StreetNumber,StreetName,ListingKey",
  };
  try {
    const data = await bridgeODataGet<BridgeODataValueResponse<Record<string, unknown>>>(cfg, query);
    return data.value ?? [];
  } catch {
    return [];
  }
}

export async function bridgeGetSearchSuggestions(raw: string): Promise<SearchSuggestion[]> {
  const cfg = getBridgeODataConfig();
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

export async function bridgeGetMlsListingById(mlsId: string): Promise<MlsListingRow | null> {
  const cfg = getBridgeODataConfig();
  if (!cfg) return null;
  const client: BridgeODataConfig = cfg;

  const id = mlsId.trim();
  if (!id) return null;

  const esc = escapeODataString(id);

  async function fetchRow(filter: string, select: string): Promise<Record<string, unknown> | null> {
    const data = await bridgeODataGet<BridgeODataValueResponse<Record<string, unknown>>>(client, {
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
        mediaUrls = await fetchBridgeMediaUrlsForListing(
          client,
          listingKey || listingId,
          listingId || listingKey,
        );
      } catch (e) {
        console.warn("bridgeGetMlsListingById: media fetch failed (page still loads)", e);
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
          `bridgeGetMlsListingById: attempt failed filter=${filter.slice(0, 100)}… selectFields=${select.split(",").length}`,
          e,
        );
      }
    }
  }

  return null;
}

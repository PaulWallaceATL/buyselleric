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
import { pointInPolygon } from "@/lib/geo";
import { parseCityStateSearchQuery } from "@/lib/listing-query-text";
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

function sanitizeBridgePropertySelect(select: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of select
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((field) => !GAMLS_BLOCKED_SELECT_FIELDS.has(field))) {
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

function buildFilter(filters: ListingFilters): string {
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
    if (cityState) {
      const city = escapeODataString(cityState.city.toLowerCase());
      parts.push(`contains(tolower(City), '${city}')`);
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

function gridSelectForFilters(filters: ListingFilters): string {
  const wantsCoords = filters.mapPolygon != null && filters.mapPolygon.length >= 3;
  const raw = wantsCoords ? `${SELECT_GRID},Latitude,Longitude` : SELECT_GRID;
  return sanitizeBridgePropertySelect(raw);
}

const MAP_POLYGON_FETCH_CAP = 2_000;

function filterUnifiedInPolygon(filters: ListingFilters, rows: UnifiedListing[]): UnifiedListing[] {
  const poly = filters.mapPolygon;
  if (!poly || poly.length < 3) return rows;
  return rows.filter(
    (u) =>
      u.latitude != null &&
      u.longitude != null &&
      pointInPolygon(u.latitude, u.longitude, poly),
  );
}

/** Map polygon: fetch a capped bbox window, strict point-in-polygon, then paginate in memory. */
async function bridgeSearchWithMapPolygon(
  cfg: BridgeODataConfig,
  filters: ListingFilters,
): Promise<PaginatedResult> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(200, Math.max(1, filters.perPage ?? 24));
  const skip = (page - 1) * perPage;

  const polyQuery: Record<string, string> = {
    $filter: buildFilter(filters),
    $select: gridSelectForFilters(filters),
    $top: String(MAP_POLYGON_FETCH_CAP),
    $skip: "0",
    $orderby: orderByClause(filters.sort),
  };

  try {
    const data = await bridgeODataGet<BridgeODataValueResponse<Record<string, unknown>>>(cfg, {
      ...polyQuery,
      $count: "true",
    });
    const unified = filterUnifiedInPolygon(
      filters,
      (data.value ?? []).map((row) => rowToUnified(row)),
    );
    const total = unified.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
    const listings = unified.slice(skip, skip + perPage);
    return { listings, total, page, perPage, totalPages };
  } catch (e1) {
    console.warn("bridgeSearchWithMapPolygon: $count failed, retrying without $count", e1);
    try {
      const data = await bridgeODataGet<BridgeODataValueResponse<Record<string, unknown>>>(cfg, polyQuery);
      const unified = filterUnifiedInPolygon(
        filters,
        (data.value ?? []).map((row) => rowToUnified(row)),
      );
      const total = unified.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);
      const listings = unified.slice(skip, skip + perPage);
      return { listings, total, page, perPage, totalPages };
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      console.error("bridgeSearchWithMapPolygon", msg, e2);
      return { listings: [], total: 0, page, perPage, totalPages: 0 };
    }
  }
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

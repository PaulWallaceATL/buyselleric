import type { MlsListingRow } from "@/lib/types/db";
import {
  bridgeODataGet,
  bridgePropertyToCoreFields,
  escapeODataString,
  fetchBridgeMediaUrlsForListing,
  getBridgeODataConfig,
  type BridgeODataConfig,
  type BridgeODataValueResponse,
  type BridgePropertyMapOptions,
} from "@/lib/bridge-odata";
import type { ListingFilters, PaginatedResult, UnifiedListing } from "@/lib/listings-queries";
import type { SearchSuggestion } from "@/lib/listing-search-suggest";

const ACTIVE = "(tolower(StandardStatus) eq 'active' or tolower(MlsStatus) eq 'active')";

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

/** Search/grid: card + map fields + inline Media (first-page thumbs). */
const SELECT_GRID =
  "ListingKey,ListingId,UnparsedAddress,StreetNumber,StreetDirPrefix,StreetName,StreetSuffix,StreetDirSuffix,UnitNumber,Unit,City,StateOrProvince,PostalCode,ListPrice,BedroomsTotal,BathroomsTotalInteger,BathroomsFull,BathroomsHalf,BathroomsTotalDecimal,BathroomsTotal,LivingArea,BuildingAreaTotal,Latitude,Longitude,ListAgentFullName,ListAgent,CoListAgentFullName,CoListAgent,ListOfficeName,ListOffice,ListOfficePhone,PublicRemarks,PropertyType,PropertySubType,StandardStatus,MlsStatus,SubdivisionName,Media,ModificationTimestamp";

/**
 * Detail page: broad housing + remarks fields, no inline Media (full gallery via `Media` entity).
 * Override with BRIDGE_PROPERTY_SELECT_DETAIL if your MLS rejects unknown columns.
 */
const SELECT_DETAIL_DEFAULT =
  `${SELECT_GRID.replace(",Media,", ",")},YearBuilt,LotSizeSquareFeet,LotSizeAcres,StoriesTotal,GarageSpaces,ParkingTotal,PoolPrivateYN,SpaYN,CountyOrParish,DaysOnMarket,OnMarketDate,Heating,Cooling,View,Appliances,InteriorFeatures,ExteriorFeatures,ArchitecturalStyle,AssociationFee,AssociationFeeFrequency,AssociationName,Zoning,SupplementalPublicRemarks,PrivateRemarks`;

function selectDetail(): string {
  const override = process.env.BRIDGE_PROPERTY_SELECT_DETAIL?.trim();
  return override || SELECT_DETAIL_DEFAULT;
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
    const cityState = q.match(/^(.+?),\s*(.+)$/);
    if (cityState?.[1] && cityState[2]) {
      const city = escapeODataString(cityState[1].trim().toLowerCase());
      const st = escapeODataString(cityState[2].trim().toLowerCase());
      parts.push(`contains(tolower(City), '${city}')`);
      parts.push(`contains(tolower(StateOrProvince), '${st}')`);
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

export async function bridgeSearchWithFilters(filters: ListingFilters): Promise<PaginatedResult> {
  const cfg = getBridgeODataConfig();
  if (!cfg) {
    return { listings: [], total: 0, page: 1, perPage: 24, totalPages: 0 };
  }

  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(200, Math.max(1, filters.perPage ?? 24));
  const skip = (page - 1) * perPage;

  const query: Record<string, string> = {
    $filter: buildFilter(filters),
    $select: SELECT_GRID,
    $top: String(perPage),
    $skip: String(skip),
    $orderby: orderByClause(filters.sort),
    $count: "true",
  };

  try {
    const data = await bridgeODataGet<BridgeODataValueResponse<Record<string, unknown>>>(cfg, query);
    const rows = data.value ?? [];
    const total = typeof data["@odata.count"] === "number" ? data["@odata.count"] : rows.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / perPage);

    return {
      listings: rows.map((row) => rowToUnified(row)),
      total,
      page,
      perPage,
      totalPages,
    };
  } catch (e) {
    console.error("bridgeSearchWithFilters", e);
    return { listings: [], total: 0, page, perPage, totalPages: 0 };
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

  const q = raw.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64).toLowerCase();
  if (q.length < 2) return [];

  const esc = escapeODataString(q);
  const zipish = /^[\d-]+$/.test(q.replace(/\s/g, ""));

  const [cityRows, zipRows, addrRows] = await Promise.all([
    suggestQuery(cfg, `contains(tolower(City), '${esc}')`, 28),
    zipish
      ? suggestQuery(cfg, `startswith(PostalCode, '${escapeODataString(q.replace(/\s/g, ""))}')`, 24)
      : suggestQuery(cfg, `contains(PostalCode, '${esc}')`, 20),
    suggestQuery(cfg, `contains(tolower(UnparsedAddress), '${esc}')`, 14),
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

  const id = mlsId.trim();
  if (!id) return null;

  const esc = escapeODataString(id);
  const query: Record<string, string> = {
    $filter: `${ACTIVE} and (ListingId eq '${esc}' or ListingKey eq '${esc}')`,
    $select: selectDetail(),
    $top: "1",
  };

  try {
    const data = await bridgeODataGet<BridgeODataValueResponse<Record<string, unknown>>>(cfg, query);
    const row = data.value?.[0];
    if (!row) return null;
    const listingKey = String(row.ListingKey ?? "").trim();
    const listingId = String(row.ListingId ?? "").trim();
    const mediaUrls =
      listingKey || listingId
        ? await fetchBridgeMediaUrlsForListing(cfg, listingKey || listingId, listingId || listingKey)
        : [];
    const mapOpts: BridgePropertyMapOptions =
      mediaUrls.length > 0 ? { supplementalImageUrls: mediaUrls } : {};
    return rowToMlsListingRow(row, mapOpts);
  } catch (e) {
    console.error("bridgeGetMlsListingById", e);
    return null;
  }
}

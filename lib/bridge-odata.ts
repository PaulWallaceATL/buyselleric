/**
 * Bridge Interactive (Bridge Data Output) — RESO Web API OData.
 * Docs: https://bridgedataoutput.com/docs/platform/Introduction/Signing-up-with-Bridge-API
 *
 * Server token: Authorization: Bearer <token> (or access_token query param).
 */

const DEFAULT_BASE = "https://api.bridgedataoutput.com/api/v2/OData";

export interface BridgeODataConfig {
  serverToken: string;
  datasetId: string;
  /** e.g. "Property", "Properties", or "idx/Properties" for IDX-only */
  entityPath: string;
  baseUrl: string;
}

export function getBridgeODataConfig(): BridgeODataConfig | null {
  const serverToken = process.env.BRIDGE_SERVER_TOKEN?.trim();
  const datasetId = process.env.BRIDGE_DATASET_ID?.trim();
  if (!serverToken || !datasetId) return null;

  const baseUrl = (process.env.BRIDGE_ODATA_BASE?.trim() || DEFAULT_BASE).replace(/\/$/, "");
  const entityPath = (process.env.BRIDGE_ODATA_ENTITY?.trim() || "Property").replace(/^\/+/, "");

  return { serverToken, datasetId, entityPath, baseUrl };
}

export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function entityCollectionUrl(cfg: BridgeODataConfig): string {
  return `${cfg.baseUrl}/${cfg.datasetId}/${cfg.entityPath}`;
}

export async function bridgeODataGet<T>(cfg: BridgeODataConfig, query: Record<string, string>): Promise<T> {
  const url = new URL(entityCollectionUrl(cfg));
  for (const [k, v] of Object.entries(query)) {
    if (v !== "") url.searchParams.set(k, v);
  }

  return bridgeODataGetAbsolute<T>(cfg, url.toString());
}

/** Any OData URL under the same auth (Property, Media, @odata.nextLink, …). */
export async function bridgeODataGetAbsolute<T>(cfg: BridgeODataConfig, requestUrl: string): Promise<T> {
  const res = await fetch(requestUrl, {
    headers: {
      Authorization: `Bearer ${cfg.serverToken}`,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bridge OData ${res.status}: ${body.slice(0, 400)}`);
  }

  return (await res.json()) as T;
}

export function odataResourceCollectionUrl(cfg: BridgeODataConfig, resourcePath: string): string {
  const path = resourcePath.replace(/^\/+/, "");
  return `${cfg.baseUrl}/${cfg.datasetId}/${path}`;
}

type ODataValueBundle<T> = {
  value?: T[];
  ["@odata.nextLink"]?: string;
};

/** Follow @odata.nextLink until exhausted (e.g. all Media rows). */
export async function bridgeODataFetchAllValueRows(
  cfg: BridgeODataConfig,
  firstPageUrl: URL,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let pageUrl: string | null = firstPageUrl.toString();

  while (pageUrl) {
    const data: ODataValueBundle<Record<string, unknown>> = await bridgeODataGetAbsolute(cfg, pageUrl);
    const chunk = data.value ?? [];
    out.push(...chunk);
    const rawNext = data["@odata.nextLink"];
    pageUrl = rawNext ? new URL(rawNext, pageUrl).toString() : null;
  }

  return out;
}

export interface BridgeODataValueResponse<T> {
  value?: T[];
  /** @odata.count when $count=true */
  ["@odata.count"]?: number;
}

function dedupeUrlsPreserveOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = u.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Best single URL per media row — same preference order as RETS photo picker
 * so we do not store thumbnail + midsize + full as separate gallery slots.
 */
export function bestPhotoUrlFromMediaRow(m: Record<string, unknown>): string {
  const preference = [
    "OriginalURL",
    "MediaURLFull",
    "MediaURLHiRes",
    "MediaURL",
    "MediaMidsizeURL",
    "MediaThumbnailURL",
    "ImageURL",
    "PhotoURL",
    "URL",
    "Url",
  ] as const;
  for (const k of preference) {
    const v = m[k];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  for (const v of Object.values(m)) {
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return "";
}

function mediaRowPreferred(m: Record<string, unknown>): boolean {
  const p = m.PreferredPhoto;
  return p === true || p === "Y" || p === "y" || p === "true" || p === "1" || p === 1;
}

function mediaRowOrder(m: Record<string, unknown>): number {
  const o = m.Order ?? m.MediaOrder ?? m.ImageOrderPrimary;
  const n = typeof o === "number" ? o : Number.parseFloat(String(o ?? "999"));
  return Number.isFinite(n) ? n : 999;
}

/** Normalize Bridge `Media` JSON (array, @odata.bind wrapper, or { value }) into rows. */
export function normalizeMediaRows(media: unknown): Record<string, unknown>[] {
  if (media == null) return [];
  if (Array.isArray(media)) {
    return media.filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === "object");
  }
  if (typeof media === "object") {
    const o = media as Record<string, unknown>;
    if (Array.isArray(o.value)) {
      return o.value.filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === "object");
    }
  }
  return [];
}

/** Ordered photo URLs from inline `Media` on a Property row (or Media entity rows). */
export function extractOrderedPhotoUrlsFromMediaRows(rows: Record<string, unknown>[]): string[] {
  const scored = rows
    .map((m) => ({
      preferred: mediaRowPreferred(m),
      order: mediaRowOrder(m),
      url: bestPhotoUrlFromMediaRow(m),
    }))
    .filter((x) => /^https?:\/\//i.test(x.url));

  scored.sort((a, b) => {
    if (a.preferred && !b.preferred) return -1;
    if (!a.preferred && b.preferred) return 1;
    return a.order - b.order;
  });

  return dedupeUrlsPreserveOrder(scored.map((s) => s.url));
}

export function extractMediaUrls(media: unknown): string[] {
  return extractOrderedPhotoUrlsFromMediaRows(normalizeMediaRows(media));
}

/** Max URLs stored per listing (aligned with RETS sync cap). */
export const BRIDGE_MEDIA_MAX_URLS = 250;

function defaultMediaEntityPath(): string {
  return (process.env.BRIDGE_MEDIA_ENTITY?.trim() || "Media").replace(/^\/+/, "");
}

function isLikelyImageUrl(u: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif|bmp)(\?|$)/i.test(u) || /format=(webp|jpeg|jpg|png)/i.test(u);
}

/**
 * Load all photo URLs for a listing from the OData `Media` entity (paginated),
 * using the same linkage patterns as our RETS/GAMLS media probe.
 */
export async function fetchBridgeMediaUrlsForListing(
  cfg: BridgeODataConfig,
  listingKey: string,
  listingId: string,
): Promise<string[]> {
  const segments = [...new Set([listingKey, listingId].map((s) => s.trim()).filter(Boolean))];
  if (segments.length === 0) return [];

  const orClauses: string[] = [];
  for (const s of segments) {
    const e = escapeODataString(s);
    orClauses.push(
      `(ResourceRecordKey eq '${e}')`,
      `(ListingKey eq '${e}')`,
      `(MediaListingKey eq '${e}')`,
      `(ListingId eq '${e}')`,
    );
  }
  const keyFilter = `(${orClauses.join(" or ")})`;
  const photoFilter = `(tolower(MediaCategory) eq 'photo')`;
  const tryFilters = [`${keyFilter} and ${photoFilter}`, keyFilter];

  for (const filter of tryFilters) {
    try {
      const u = new URL(odataResourceCollectionUrl(cfg, defaultMediaEntityPath()));
      u.searchParams.set("$filter", filter);
      u.searchParams.set("$orderby", "Order asc,MediaOrder asc");
      u.searchParams.set("$top", "200");

      const rows = await bridgeODataFetchAllValueRows(cfg, u);
      let urls = extractOrderedPhotoUrlsFromMediaRows(rows);
      if (urls.length === 0 && rows.length > 0) {
        urls = extractOrderedPhotoUrlsFromMediaRows(
          rows.filter((r) => {
            const u0 = bestPhotoUrlFromMediaRow(r);
            return !u0 || isLikelyImageUrl(u0);
          }),
        );
      }
      urls = urls.filter(isLikelyImageUrl);
      if (urls.length > 0) return dedupeUrlsPreserveOrder(urls).slice(0, BRIDGE_MEDIA_MAX_URLS);
    } catch {
      /* try next filter variant */
    }
  }

  return [];
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = num(v);
  return n === 0 && String(v).trim() === "" ? null : n;
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseBathroomsTotal(row: Record<string, unknown>): number {
  const dec = num(row.BathroomsTotalDecimal);
  if (dec > 0) return dec;
  const full = num(row.BathroomsFull);
  const half = num(row.BathroomsHalf);
  if (full > 0 || half > 0) return full + half * 0.5;
  const ti = num(row.BathroomsTotalInteger);
  if (ti > 0) return ti;
  const tot = num(row.BathroomsTotal);
  if (tot > 0) return tot;
  return 0;
}

function mergeImageLists(primary: string[], secondary: string[]): string[] {
  return dedupeUrlsPreserveOrder([...primary, ...secondary]);
}

function housingFactsAppendix(row: Record<string, unknown>): string {
  const lines: string[] = [];
  const y = num(row.YearBuilt);
  if (y >= 1700 && y <= 2100) lines.push(`Year built: ${y}`);

  const lotSq = numOrNull(row.LotSizeSquareFeet);
  if (lotSq != null && lotSq > 0) lines.push(`Lot size: ${Math.round(lotSq).toLocaleString()} sq ft`);

  const acres = numOrNull(row.LotSizeAcres);
  if (acres != null && acres > 0) lines.push(`Lot size: ${acres} acres`);

  const stories = num(row.StoriesTotal);
  if (stories > 0) lines.push(`Stories: ${stories}`);

  const garage = num(row.GarageSpaces);
  if (garage > 0) lines.push(`Garage spaces: ${garage}`);

  const parking = num(row.ParkingTotal);
  if (parking > 0 && garage === 0) lines.push(`Parking spaces: ${parking}`);

  const pool = str(row.PoolPrivateYN);
  if (pool && /^y/i.test(pool)) lines.push("Pool");

  const spa = str(row.SpaYN);
  if (spa && /^y/i.test(spa)) lines.push("Spa");

  const county = str(row.CountyOrParish);
  if (county) lines.push(`County: ${county}`);

  const dom = num(row.DaysOnMarket);
  if (dom > 0) lines.push(`Days on market: ${dom}`);

  const om = str(row.OnMarketDate);
  if (om) lines.push(`On market: ${om}`);

  const addList = (label: string, v: unknown) => {
    const s = str(v);
    if (!s) return;
    lines.push(`${label}: ${s}`);
  };

  addList("Heating", row.Heating);
  addList("Cooling", row.Cooling);
  addList("View", row.View);
  addList("Appliances", row.Appliances);
  addList("Interior features", row.InteriorFeatures);
  addList("Exterior features", row.ExteriorFeatures);
  addList("Architectural style", row.ArchitecturalStyle);

  const af = num(row.AssociationFee);
  if (af > 0) {
    const freq = str(row.AssociationFeeFrequency);
    lines.push(freq ? `HOA fee: ${af.toLocaleString()} / ${freq}` : `HOA fee: ${af.toLocaleString()}`);
  }
  const an = str(row.AssociationName);
  if (an) lines.push(`Association: ${an}`);

  const zoning = str(row.Zoning);
  if (zoning) lines.push(`Zoning: ${zoning}`);

  if (lines.length === 0) return "";
  return `\n\n—\n${lines.join("\n")}`;
}

function buildDescription(row: Record<string, unknown>): string {
  const pub = str(row.PublicRemarks);
  const sup = str(row.SupplementalPublicRemarks);
  const priv = str(row.PrivateRemarks);
  const body = [pub, sup, priv].filter(Boolean).join("\n\n");
  return ((body || "") + housingFactsAppendix(row)).trim();
}

export interface BridgePropertyMapOptions {
  /** Extra URLs (e.g. from OData `Media` entity); merged ahead of inline `Media`. */
  supplementalImageUrls?: string[] | undefined;
}

/** Map RESO Property JSON (Bridge) → fields aligned with our RETS / DB shape */
export function bridgePropertyToCoreFields(
  row: Record<string, unknown>,
  options?: BridgePropertyMapOptions,
): {
  listingKey: string;
  listingId: string;
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
  description: string;
  property_type: string;
  status: string;
  image_urls: string[];
  listing_agent: string;
  listing_office: string;
} {
  const listingKey = str(row.ListingKey) || str(row.Id);
  const listingId = str(row.ListingId) || listingKey;
  const unparsed = str(row.UnparsedAddress);
  const streetNum = str(row.StreetNumber);
  const streetDir = str(row.StreetDirPrefix);
  const streetName = str(row.StreetName);
  const streetSuffix = str(row.StreetSuffix);
  const streetDirSuf = str(row.StreetDirSuffix);
  const unit = str(row.UnitNumber) || str(row.Unit);

  let address_line = unparsed;
  if (!address_line) {
    const parts = [streetNum, streetDir, streetName, streetSuffix, streetDirSuf].filter(Boolean);
    address_line = parts.join(" ");
    if (unit) address_line += ` #${unit}`;
  }

  const city = str(row.City);
  const state = str(row.StateOrProvince) || "GA";
  const postal_code = str(row.PostalCode);
  const priceDollars = num(row.ListPrice);
  const subdivision = str(row.SubdivisionName);
  const validSub = subdivision && subdivision.toLowerCase() !== "none" ? subdivision : "";

  const baths = parseBathroomsTotal(row);

  const inlinePhotos = extractMediaUrls(row.Media);
  const extra = options?.supplementalImageUrls ?? [];
  const image_urls = mergeImageLists(extra, inlinePhotos).slice(0, BRIDGE_MEDIA_MAX_URLS);

  const listing_agent =
    str(row.ListAgentFullName) || str(row.ListAgent) || str(row.CoListAgentFullName) || str(row.CoListAgent);
  const officePhone = str(row.ListOfficePhone);
  const officeName = str(row.ListOfficeName) || str(row.ListOffice);
  const listing_office = officePhone && officeName ? `${officeName} · ${officePhone}` : officeName || officePhone;

  return {
    listingKey,
    listingId,
    title: validSub ? `${validSub} · ${address_line || `${city} home`}` : address_line || `${city} home`,
    address_line: address_line || `${city}`,
    city,
    state,
    postal_code,
    price_cents: Math.round(priceDollars * 100),
    bedrooms: Math.round(num(row.BedroomsTotal)),
    bathrooms: baths,
    square_feet: numOrNull(row.LivingArea) ?? numOrNull(row.BuildingAreaTotal),
    latitude: numOrNull(row.Latitude),
    longitude: numOrNull(row.Longitude),
    description: buildDescription(row),
    property_type: str(row.PropertySubType) || str(row.PropertyType),
    status: str(row.StandardStatus) || str(row.MlsStatus) || "active",
    image_urls,
    listing_agent,
    listing_office,
  };
}

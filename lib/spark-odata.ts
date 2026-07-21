/**
 * Spark Platform — RESO Web API v3 OData.
 * Docs: https://sparkplatform.com/docs/reso/overview
 *
 * Auth: Authorization: Bearer <SPARK_ACCESS_TOKEN>  +  Accept: application/json
 *       (https://sparkplatform.com/docs/authentication/access_token)
 *
 * Unlike Bridge, the Spark URL has no per-feed dataset segment — the access token
 * itself selects which MLS data the caller is authorized to see.
 */

import {
  bestPhotoUrlFromMediaRow,
  extractOrderedPhotoUrlsFromMediaRows,
  isLikelyImageUrl,
  isProbablyDisplayablePhotoUrl,
  type ODataValueResponse,
} from "@/lib/reso-odata";

const DEFAULT_BASE = "https://replication.sparkapi.com/Version/3/Reso/OData";
const DEFAULT_PROPERTY_ENTITY = "Property";
const DEFAULT_MEDIA_ENTITY = "Media";

export interface SparkODataConfig {
  accessToken: string;
  /** Informational only ("OAuth Key") — useful for support tickets and logs. */
  apiFeedId: string;
  baseUrl: string;
  /** RESO Property collection path. */
  entityPath: string;
}

export function getSparkODataConfig(): SparkODataConfig | null {
  const accessToken = process.env.SPARK_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;

  const baseUrl = (process.env.SPARK_ODATA_BASE?.trim() || DEFAULT_BASE).replace(/\/$/, "");
  const entityPath = (process.env.SPARK_PROPERTY_ENTITY?.trim() || DEFAULT_PROPERTY_ENTITY).replace(
    /^\/+/,
    "",
  );
  const apiFeedId = process.env.SPARK_API_FEED_ID?.trim() ?? "";

  return { accessToken, apiFeedId, baseUrl, entityPath };
}

export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function entityCollectionUrl(cfg: SparkODataConfig): string {
  return `${cfg.baseUrl}/${cfg.entityPath}`;
}

function buildHeaders(cfg: SparkODataConfig): HeadersInit {
  return {
    Authorization: `Bearer ${cfg.accessToken}`,
    Accept: "application/json",
    "User-Agent": "buyselleric/1.0 (+https://buyselleric.com)",
  };
}

export async function sparkODataGet<T>(
  cfg: SparkODataConfig,
  query: Record<string, string>,
  options?: { revalidate?: number },
): Promise<T> {
  const url = new URL(entityCollectionUrl(cfg));
  for (const [k, v] of Object.entries(query)) {
    if (v !== "") url.searchParams.set(k, v);
  }
  return sparkODataGetAbsolute<T>(cfg, url.toString(), options);
}

/** Any OData URL under the same auth (Property, Media, @odata.nextLink, …). */
export async function sparkODataGetAbsolute<T>(
  cfg: SparkODataConfig,
  requestUrl: string,
  options?: { revalidate?: number },
): Promise<T> {
  const res = await fetch(requestUrl, {
    headers: buildHeaders(cfg),
    next: { revalidate: options?.revalidate ?? 0 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spark OData ${res.status}: ${body.slice(0, 400)}`);
  }

  return (await res.json()) as T;
}

export function odataResourceCollectionUrl(cfg: SparkODataConfig, resourcePath: string): string {
  const path = resourcePath.replace(/^\/+/, "");
  return `${cfg.baseUrl}/${path}`;
}

/** Follow @odata.nextLink until exhausted (e.g. all Media rows). */
export async function sparkODataFetchAllValueRows(
  cfg: SparkODataConfig,
  firstPageUrl: URL,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let pageUrl: string | null = firstPageUrl.toString();

  while (pageUrl) {
    const data: ODataValueResponse<Record<string, unknown>> = await sparkODataGetAbsolute(cfg, pageUrl);
    const chunk = data.value ?? [];
    out.push(...chunk);
    const rawNext = data["@odata.nextLink"];
    pageUrl = rawNext ? new URL(rawNext, pageUrl).toString() : null;
  }

  return out;
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

/** Max URLs stored per listing (aligned with RETS / Bridge sync caps). */
export const SPARK_MEDIA_MAX_URLS = 250;

function defaultMediaEntityPath(): string {
  return (process.env.SPARK_MEDIA_ENTITY?.trim() || DEFAULT_MEDIA_ENTITY).replace(/^\/+/, "");
}

/**
 * Load all photo URLs for a listing from the OData `Media` entity (paginated).
 * Mirrors the Bridge / RETS media probe so we exhaust the same RESO field
 * variants regardless of the upstream feed.
 */
export async function fetchSparkMediaUrlsForListing(
  cfg: SparkODataConfig,
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
    if (/^\d+$/.test(s)) {
      orClauses.push(`(ListingId eq ${s})`, `(ListingKey eq ${s})`);
    }
  }
  const keyFilter = `(${orClauses.join(" or ")})`;
  const photoFilter = `(tolower(MediaCategory) eq 'photo')`;
  const tryFilters = [`${keyFilter} and ${photoFilter}`, keyFilter];

  const orderByVariants = ["Order asc,MediaOrder asc", "MediaOrder asc", "Order asc"];

  for (const filter of tryFilters) {
    for (const ob of orderByVariants) {
      try {
        const u = new URL(odataResourceCollectionUrl(cfg, defaultMediaEntityPath()));
        u.searchParams.set("$filter", filter);
        u.searchParams.set("$orderby", ob);
        u.searchParams.set("$top", "200");

        const rows = await sparkODataFetchAllValueRows(cfg, u);
        let urls = extractOrderedPhotoUrlsFromMediaRows(rows);
        if (urls.length === 0 && rows.length > 0) {
          urls = extractOrderedPhotoUrlsFromMediaRows(
            rows.filter((r) => {
              const u0 = bestPhotoUrlFromMediaRow(r);
              return !u0 || isLikelyImageUrl(u0);
            }),
          );
        }
        const strict = urls.filter(isLikelyImageUrl);
        const loose = strict.length > 0 ? strict : urls.filter(isProbablyDisplayablePhotoUrl);
        if (loose.length > 0) return dedupeUrlsPreserveOrder(loose).slice(0, SPARK_MEDIA_MAX_URLS);
      } catch {
        /* try next orderBy / filter variant */
      }
    }
    try {
      const u = new URL(odataResourceCollectionUrl(cfg, defaultMediaEntityPath()));
      u.searchParams.set("$filter", filter);
      u.searchParams.set("$top", "200");
      const rows = await sparkODataFetchAllValueRows(cfg, u);
      const urls = extractOrderedPhotoUrlsFromMediaRows(rows);
      const strict = urls.filter(isLikelyImageUrl);
      const loose = strict.length > 0 ? strict : urls.filter(isProbablyDisplayablePhotoUrl);
      if (loose.length > 0) return dedupeUrlsPreserveOrder(loose).slice(0, SPARK_MEDIA_MAX_URLS);
    } catch {
      /* try next filter variant */
    }
  }

  return [];
}

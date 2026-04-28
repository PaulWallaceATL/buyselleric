import { bridgeGetMlsListingById, bridgeSearchWithFilters, isBridgeListingsEnabled } from "@/lib/bridge-listings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ListingRow, MlsListingRow } from "@/lib/types/db";

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
}

export interface PaginatedResult {
  listings: UnifiedListing[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

function manualToUnified(l: ListingRow): UnifiedListing {
  return {
    id: l.id, slug: l.slug, mls_id: null, title: l.title,
    address_line: l.address_line, city: l.city, state: l.state,
    postal_code: l.postal_code, price_cents: l.price_cents,
    bedrooms: l.bedrooms, bathrooms: l.bathrooms,
    square_feet: l.square_feet, latitude: l.latitude,
    longitude: l.longitude, image_urls: l.image_urls, source: "manual",
  };
}

/** "Atlanta, GA" → city contains Atlanta AND state contains GA (comma searches failed with single %term%). */
function splitCityStateQuery(q: string): { city: string; state: string } | null {
  const m = q.trim().match(/^(.+?),\s*(.+)$/);
  if (!m?.[1] || !m[2]) return null;
  const city = m[1].trim();
  const state = m[2].trim();
  if (!city || !state || city.length > 120 || state.length > 40) return null;
  return { city, state };
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

export async function searchWithFilters(filters: ListingFilters): Promise<PaginatedResult> {
  if (isBridgeListingsEnabled()) {
    return bridgeSearchWithFilters(filters);
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
    const cityState = splitCityStateQuery(trimmed);
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
    const cityState = splitCityStateQuery(trimmed);
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
  if (isBridgeListingsEnabled()) {
    const fromBridge = await bridgeGetMlsListingById(mlsId);
    if (fromBridge) return fromBridge;
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

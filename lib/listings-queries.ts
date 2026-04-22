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

function manualToUnified(l: ListingRow): UnifiedListing {
  return {
    id: l.id,
    slug: l.slug,
    mls_id: null,
    title: l.title,
    address_line: l.address_line,
    city: l.city,
    state: l.state,
    postal_code: l.postal_code,
    price_cents: l.price_cents,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    square_feet: l.square_feet,
    latitude: l.latitude,
    longitude: l.longitude,
    image_urls: l.image_urls,
    source: "manual",
  };
}

function mlsToUnified(m: MlsListingRow): UnifiedListing {
  return {
    id: m.id,
    slug: null,
    mls_id: m.mls_id,
    title: m.title || `${m.address_line}, ${m.city}`,
    address_line: m.address_line,
    city: m.city,
    state: m.state,
    postal_code: m.postal_code,
    price_cents: m.price_cents,
    bedrooms: m.bedrooms,
    bathrooms: m.bathrooms,
    square_feet: m.square_feet,
    latitude: m.latitude,
    longitude: m.longitude,
    image_urls: m.image_urls,
    source: "mls",
    listing_agent: m.listing_agent,
    listing_office: m.listing_office,
  };
}

export async function getPublishedListings(): Promise<ListingRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getPublishedListings", error.message);
    return [];
  }
  return (data ?? []) as ListingRow[];
}

export async function searchAllListings(query: string): Promise<UnifiedListing[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const term = `%${query.trim()}%`;

  const [manualResult, mlsResult] = await Promise.all([
    supabase
      .from("listings")
      .select("*")
      .or(
        `address_line.ilike.${term},city.ilike.${term},state.ilike.${term},postal_code.ilike.${term},title.ilike.${term}`,
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("mls_listings")
      .select("*")
      .or(
        `address_line.ilike.${term},city.ilike.${term},postal_code.ilike.${term},title.ilike.${term}`,
      )
      .eq("status", "active")
      .order("price_cents", { ascending: false })
      .limit(100),
  ]);

  const manual = ((manualResult.data ?? []) as ListingRow[]).map(manualToUnified);
  const mls = ((mlsResult.data ?? []) as MlsListingRow[]).map(mlsToUnified);

  return [...manual, ...mls];
}

export async function getAllListingsWithMls(): Promise<UnifiedListing[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const [manualResult, mlsResult] = await Promise.all([
    supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("mls_listings")
      .select("*")
      .eq("status", "active")
      .order("price_cents", { ascending: false })
      .limit(200),
  ]);

  const manual = ((manualResult.data ?? []) as ListingRow[]).map(manualToUnified);
  const mls = ((mlsResult.data ?? []) as MlsListingRow[]).map(mlsToUnified);

  return [...manual, ...mls];
}

export async function searchListings(query: string): Promise<ListingRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const term = `%${query.trim()}%`;
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .or(
      `address_line.ilike.${term},city.ilike.${term},state.ilike.${term},postal_code.ilike.${term},title.ilike.${term}`,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("searchListings", error.message);
    return [];
  }
  return (data ?? []) as ListingRow[];
}

export async function getPublishedListingBySlug(slug: string): Promise<ListingRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("listings").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    console.error("getPublishedListingBySlug", error.message);
    return null;
  }
  return data as ListingRow | null;
}

export async function getMlsListingById(mlsId: string): Promise<MlsListingRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("mls_listings")
    .select("*")
    .eq("mls_id", mlsId)
    .maybeSingle();
  if (error) {
    console.error("getMlsListingById", error.message);
    return null;
  }
  return data as MlsListingRow | null;
}

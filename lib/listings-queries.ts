import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ListingRow } from "@/lib/types/db";

export async function getPublishedListings(): Promise<ListingRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }
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

export async function getPublishedListingBySlug(slug: string): Promise<ListingRow | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.from("listings").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    console.error("getPublishedListingBySlug", error.message);
    return null;
  }
  return data as ListingRow | null;
}

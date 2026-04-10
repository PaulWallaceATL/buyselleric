import { createClient } from "@supabase/supabase-js";
import type { BlogPostRow, ListingRow, SellSubmissionRow } from "@/lib/types/db";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    return null;
  }
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function adminListListings(client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { data, error } = await client
    .from("listings")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ListingRow[];
}

export async function adminGetListing(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  id: string
) {
  const { data, error } = await client.from("listings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as ListingRow | null;
}

export async function adminListSubmissions(client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { data, error } = await client
    .from("sell_submissions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SellSubmissionRow[];
}

export async function adminListBlogPosts(client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { data, error } = await client
    .from("blog_posts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlogPostRow[];
}

export async function adminGetBlogPost(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  id: string,
) {
  const { data, error } = await client.from("blog_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as BlogPostRow | null;
}

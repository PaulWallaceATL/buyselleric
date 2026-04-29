import { createClient } from "@supabase/supabase-js";
import type { BlogPostKind, BlogPostRow, ListingRow, SellSubmissionRow } from "@/lib/types/db";

const AUTOGEN_BLOG_KINDS: BlogPostKind[] = ["curated", "new_listing", "price_drop"];

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

/** Listing-driven drafts and posts (curated, new_listing, price_drop). */
export async function adminListAutogenBlogPosts(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  opts?: { draftsOnly?: boolean },
) {
  let q = client
    .from("blog_posts")
    .select("*")
    .in("post_kind", AUTOGEN_BLOG_KINDS)
    .order("created_at", { ascending: false });
  if (opts?.draftsOnly) {
    q = q.eq("is_published", false);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BlogPostRow[];
}

export function isAutogenBlogKind(kind: string | null | undefined): kind is BlogPostKind {
  return kind === "curated" || kind === "new_listing" || kind === "price_drop";
}

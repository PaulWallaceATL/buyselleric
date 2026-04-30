import { createClient } from "@supabase/supabase-js";
import type {
  BlogPostKind,
  BlogPostRow,
  ListingRow,
  SeoAgentActivityLevel,
  SeoAgentActivityRow,
  SellSubmissionRow,
} from "@/lib/types/db";

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

export function isAutogenBlogKind(
  kind: string | null | undefined,
): kind is "curated" | "new_listing" | "price_drop" {
  return kind === "curated" || kind === "new_listing" || kind === "price_drop";
}

export type NewSeoAgentActivityInput = {
  run_id: string;
  level: SeoAgentActivityLevel;
  kind: string;
  summary: string;
  detail?: Record<string, unknown> | null;
};

export async function adminInsertSeoAgentActivity(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  input: NewSeoAgentActivityInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("seo_agent_activity")
    .insert({
      run_id: input.run_id,
      level: input.level,
      kind: input.kind,
      summary: input.summary,
      detail: input.detail ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed" };
  }
  return { ok: true, id: (data as { id: string }).id };
}

export async function adminListSeoAgentActivity(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  opts?: { limit?: number; run_id?: string | null },
): Promise<SeoAgentActivityRow[]> {
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));
  let q = client.from("seo_agent_activity").select("*").order("created_at", { ascending: false }).limit(limit);
  if (opts?.run_id) {
    q = q.eq("run_id", opts.run_id);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SeoAgentActivityRow[];
}

export async function adminGetLatestSeoAgentRunSummary(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
): Promise<{ run_id: string; created_at: string } | null> {
  const { data, error } = await client
    .from("seo_agent_activity")
    .select("run_id, created_at")
    .eq("kind", "run_start")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as { run_id: string; created_at: string };
}

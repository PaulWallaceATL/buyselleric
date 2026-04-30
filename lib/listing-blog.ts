import { revalidatePath } from "next/cache";
import { siteConfig } from "@/lib/config";
import { generateFromPrompt } from "@/lib/ai-blog";
import { formatPriceUsd, slugify } from "@/lib/format";
import { defaultSocialImage } from "@/lib/metadata";
import { truncateMetaDescription } from "@/lib/seo";
import type { BlogPostKind, MlsListingRow } from "@/lib/types/db";
import { adminListBlogPosts, createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export interface ListingBlogPriceEventRow {
  id: string;
  mls_id: string;
  from_price_cents: number;
  to_price_cents: number;
  detected_at: string;
  processed_at: string | null;
  blog_post_id: string | null;
}

function newListingMaxDays(): number {
  const raw = process.env.LISTING_BLOG_NEW_MAX_DAYS ?? "14";
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

function cronLimit(): number {
  const raw = process.env.LISTING_BLOG_CRON_LIMIT ?? "3";
  const n = Number.parseInt(raw, 10);
  return Math.min(20, Math.max(1, Number.isFinite(n) ? n : 3));
}

function trimDescription(text: string, max = 1200): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export async function allocateUniqueSlug(client: AdminClient, baseSlug: string): Promise<string> {
  const existing = await adminListBlogPosts(client);
  const slugs = new Set(existing.map((p) => p.slug));
  let s = baseSlug || "listing";
  let n = 0;
  while (slugs.has(s)) {
    n += 1;
    s = `${baseSlug}-${n}`;
  }
  return s;
}

const POST_KIND_LABEL: Partial<Record<BlogPostKind, string>> = {
  curated: "curated spotlight listing",
  new_listing: "new-to-market listing",
  price_drop: "listing with a recent price reduction",
  manual: "listing",
  agent_seo: "AI SEO article",
};

function buildUserPrompt(
  row: MlsListingRow,
  kind: BlogPostKind,
  priceCtx?: { fromPriceCents: number; toPriceCents: number },
): string {
  const kindPhrase = POST_KIND_LABEL[kind] ?? "MLS listing";
  const listingPublicUrl = `${siteConfig.url}/listings/mls/${encodeURIComponent(row.mls_id)}`;
  const parts = [
    `Write a blog post about this ${kindPhrase}.`,
    ``,
    `**MLS ID:** ${row.mls_id}`,
    `**Headline / title hint:** ${row.title}`,
    `**Address:** ${row.address_line}, ${row.city}, ${row.state} ${row.postal_code}`,
    `**List price:** ${formatPriceUsd(row.price_cents)}`,
    `**Beds / baths:** ${row.bedrooms} bed, ${row.bathrooms} bath`,
    row.square_feet ? `**Approx. living area:** ${row.square_feet} sq ft` : null,
    row.property_type ? `**Property type:** ${row.property_type}` : null,
    priceCtx
      ? `**Price change:** Was ${formatPriceUsd(priceCtx.fromPriceCents)}, now ${formatPriceUsd(priceCtx.toPriceCents)}.`
      : null,
    ``,
    `**Agent remarks (use as factual source only; rewrite in your own words):**`,
    trimDescription(row.description || "(none)"),
    ``,
    `**Public listing URL (include one markdown link to this URL in the body, e.g. [View listing](${listingPublicUrl})):**`,
    listingPublicUrl,
    ``,
    `Tone: professional, local (${siteConfig.primaryMarket}), helpful for buyers. Do not invent facts beyond the data above.`,
    `Include a short CTA to contact ${siteConfig.agentName} for a showing or questions.`,
  ];
  return parts.filter(Boolean).join("\n");
}

export async function insertDraftFromListing(params: {
  client: AdminClient;
  row: MlsListingRow;
  postKind: BlogPostKind;
  priceCtx?: { fromPriceCents: number; toPriceCents: number };
}): Promise<
  { ok: true; id: string; slug: string } | { ok: false; error: string; duplicate?: boolean }
> {
  const { client, row, postKind, priceCtx } = params;

  try {
    const generated = await generateFromPrompt(buildUserPrompt(row, postKind, priceCtx));
    const baseSlug = generated.slug?.trim() || slugify(generated.title);
    const slug = await allocateUniqueSlug(client, slugify(baseSlug));

    const coverRaw =
      Array.isArray(row.image_urls) && row.image_urls.length > 0 ? String(row.image_urls[0]).trim() : "";
    const cover = coverRaw.length > 0 ? coverRaw : defaultSocialImage.url;

    const { data, error } = await client
      .from("blog_posts")
      .insert({
        slug,
        title: generated.title,
        excerpt: generated.excerpt,
        meta_description: truncateMetaDescription(generated.meta_description || generated.excerpt),
        seo_keywords: generated.seo_keywords ?? [],
        body: generated.body,
        cover_image_url: cover,
        author: siteConfig.agentName,
        is_published: false,
        published_at: null,
        source_mls_id: row.mls_id,
        post_kind: postKind,
      })
      .select("id, slug")
      .single();

    if (error || !data) {
      const duplicate = error?.code === "23505";
      return { ok: false, error: error?.message ?? "Insert failed", duplicate };
    }

    revalidatePath("/blog");
    revalidatePath("/admin/blog");

    return { ok: true, id: (data as { id: string }).id, slug: (data as { slug: string }).slug };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function runListingBlogCron(params: {
  modes: ("new_listing" | "price_drop")[];
  curatedMlsIds?: string[];
}): Promise<{
  ok: boolean;
  created: { kind: BlogPostKind; mls_id: string; slug?: string; error?: string }[];
  errors: string[];
}> {
  const client = createSupabaseAdminClient();
  if (!client) {
    return { ok: false, created: [], errors: ["Supabase admin client not configured"] };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, created: [], errors: ["OPENAI_API_KEY is not set"] };
  }

  const L = cronLimit();
  const created: { kind: BlogPostKind; mls_id: string; slug?: string; error?: string }[] = [];
  const errors: string[] = [];
  const modes = params.modes;

  const curated = (params.curatedMlsIds ?? []).map((s) => s.trim()).filter(Boolean);
  for (const mlsId of curated.slice(0, Math.min(20, Math.max(L, 5) * 4))) {
    const { data: row, error } = await client.from("mls_listings").select("*").eq("mls_id", mlsId).maybeSingle();
    if (error || !row) {
      created.push({ kind: "curated", mls_id: mlsId, error: error?.message ?? "Listing not found" });
      continue;
    }
    const listing = row as MlsListingRow;
    const { data: clash } = await client
      .from("blog_posts")
      .select("id")
      .eq("source_mls_id", mlsId)
      .eq("post_kind", "curated")
      .maybeSingle();
    if (clash) {
      created.push({ kind: "curated", mls_id: mlsId, error: "Already has curated post" });
      continue;
    }
    const r = await insertDraftFromListing({ client, row: listing, postKind: "curated" });
    if (r.ok) created.push({ kind: "curated", mls_id: mlsId, slug: r.slug });
    else created.push({ kind: "curated", mls_id: mlsId, error: r.error });
  }

  if (modes.includes("price_drop")) {
    const { data: events, error: evErr } = await client
      .from("mls_listing_price_events")
      .select("*")
      .is("processed_at", null)
      .order("detected_at", { ascending: true })
      .limit(L);

    if (evErr) errors.push(`price_events: ${evErr.message}`);
    else {
      for (const ev of (events ?? []) as ListingBlogPriceEventRow[]) {
        const { data: row, error } = await client.from("mls_listings").select("*").eq("mls_id", ev.mls_id).maybeSingle();
        if (error || !row) {
          await client
            .from("mls_listing_price_events")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", ev.id);
          continue;
        }
        const listing = row as MlsListingRow;
        const r = await insertDraftFromListing({
          client,
          row: listing,
          postKind: "price_drop",
          priceCtx: { fromPriceCents: ev.from_price_cents, toPriceCents: ev.to_price_cents },
        });
        if (r.ok) {
          await client
            .from("mls_listing_price_events")
            .update({ processed_at: new Date().toISOString(), blog_post_id: r.id })
            .eq("id", ev.id);
          created.push({ kind: "price_drop", mls_id: ev.mls_id, slug: r.slug });
        } else {
          created.push({ kind: "price_drop", mls_id: ev.mls_id, error: r.error });
        }
      }
    }
  }

  if (modes.includes("new_listing")) {
    const days = newListingMaxDays();
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data: takenRows } = await client
      .from("blog_posts")
      .select("source_mls_id")
      .eq("post_kind", "new_listing")
      .not("source_mls_id", "is", null);

    const taken = new Set((takenRows ?? []).map((t) => (t as { source_mls_id: string }).source_mls_id));

    const { data: listings, error: lErr } = await client
      .from("mls_listings")
      .select("*")
      .eq("status", "active")
      .gte("created_at", cutoff)
      .order("price_cents", { ascending: false })
      .limit(80);

    if (lErr) errors.push(`new_listing query: ${lErr.message}`);
    else {
      const candidates = ((listings ?? []) as MlsListingRow[]).filter((l) => l.mls_id && !taken.has(l.mls_id));
      let newOk = 0;
      for (const listing of candidates) {
        if (newOk >= L) break;
        const r = await insertDraftFromListing({ client, row: listing, postKind: "new_listing" });
        if (r.ok) {
          created.push({ kind: "new_listing", mls_id: listing.mls_id, slug: r.slug });
          newOk += 1;
        } else if (r.duplicate) {
          /* another row already claimed this mls for new_listing */
        } else {
          created.push({ kind: "new_listing", mls_id: listing.mls_id, error: r.error });
        }
      }
    }
  }

  return { ok: errors.length === 0, created, errors };
}

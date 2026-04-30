import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { siteConfig } from "@/lib/config";
import { slugify } from "@/lib/format";
import { defaultSocialImage } from "@/lib/metadata";
import { allocateUniqueSlug, insertDraftFromListing } from "@/lib/listing-blog";
import { truncateMetaDescription } from "@/lib/seo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MlsListingRow } from "@/lib/types/db";
import { logSeoAgentActivity } from "@/lib/seo-agent/activity";
import { generateSeoArticleFromResearch } from "@/lib/seo-agent/article";
import {
  isSeoAgentEnabled,
  seoAgentAutoPublish,
  seoAgentFeaturedMlsIds,
  seoAgentMaxListingPostsPerRun,
  seoAgentMaxSeoPostsPerRun,
  seoAgentModel,
} from "@/lib/seo-agent/config";
import { generateSeoCoverImage } from "@/lib/seo-agent/cover-image";
import { runSeoWebResearch, type SeoResearchMemo } from "@/lib/seo-agent/research";

export interface SeoAgentHeartbeatResult {
  ok: boolean;
  run_id: string;
  skipped?: boolean;
  errors: string[];
  created_seo_slugs: string[];
  created_listing: { mls_id: string; slug?: string }[];
}

async function pickFallbackFeaturedMlsId(
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
): Promise<string | null> {
  const { data: takenRows } = await client
    .from("blog_posts")
    .select("source_mls_id")
    .eq("post_kind", "curated")
    .not("source_mls_id", "is", null);
  const taken = new Set((takenRows ?? []).map((t) => (t as { source_mls_id: string }).source_mls_id));

  const { data: rows, error } = await client
    .from("mls_listings")
    .select("mls_id")
    .eq("status", "active")
    .order("synced_at", { ascending: false })
    .limit(60);
  if (error) return null;
  for (const row of (rows ?? []) as { mls_id: string }[]) {
    if (row.mls_id && !taken.has(row.mls_id)) return row.mls_id;
  }
  return null;
}

async function runSeoArticleSteps(params: {
  run_id: string;
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  memo: SeoResearchMemo;
  errors: string[];
  created_seo_slugs: string[];
}): Promise<void> {
  const { run_id, client, memo, errors, created_seo_slugs } = params;
  const maxSeo = seoAgentMaxSeoPostsPerRun();

  for (let i = 0; i < maxSeo; i++) {
    try {
      const { post, response_id: artId, usage: artUsage } = await generateSeoArticleFromResearch(memo);
      const baseSlug = post.slug?.trim() || slugify(memo.suggested_slug_hint || post.title);
      const slug = await allocateUniqueSlug(client, slugify(baseSlug));
      const cover = await generateSeoCoverImage(client, post.title, post.excerpt);
      if (!cover.ok) {
        await logSeoAgentActivity({
          run_id,
          level: "warn",
          kind: "cover_generated",
          summary: `Cover image failed, using site default: ${cover.error}`,
          detail: { title: post.title },
        });
      }
      const coverUrl = cover.ok ? cover.url : defaultSocialImage.url;
      const published = seoAgentAutoPublish();
      const publishedAt = published ? new Date().toISOString() : null;

      const { data, error } = await client
        .from("blog_posts")
        .insert({
          slug,
          title: post.title,
          excerpt: post.excerpt,
          meta_description: truncateMetaDescription(post.meta_description || post.excerpt),
          seo_keywords: post.seo_keywords ?? [],
          body: post.body,
          cover_image_url: coverUrl,
          author: siteConfig.agentName,
          is_published: published,
          published_at: publishedAt,
          post_kind: "agent_seo",
          source_mls_id: null,
        })
        .select("id, slug")
        .single();

      if (error || !data) {
        const msg = error?.message ?? "blog insert failed";
        errors.push(msg);
        await logSeoAgentActivity({
          run_id,
          level: "error",
          kind: "error_step",
          summary: msg,
          detail: {},
        });
        break;
      }
      created_seo_slugs.push((data as { slug: string }).slug);
      await logSeoAgentActivity({
        run_id,
        level: "info",
        kind: "blog_draft_created",
        summary: `SEO article: ${post.title}`,
        detail: {
          slug: (data as { slug: string }).slug,
          id: (data as { id: string }).id,
          article_response_id: artId,
          article_usage: artUsage,
          cover_generated: cover.ok,
        },
      });
      revalidatePath("/blog");
      revalidatePath("/admin/blog");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "SEO article step failed";
      errors.push(msg);
      await logSeoAgentActivity({
        run_id,
        level: "error",
        kind: "error_step",
        summary: msg,
        detail: {},
      });
    }
  }
}

async function runFeaturedListingSteps(params: {
  run_id: string;
  client: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  created_listing: { mls_id: string; slug?: string }[];
}): Promise<void> {
  const { run_id, client, created_listing } = params;
  const maxList = seoAgentMaxListingPostsPerRun();
  let ids = seoAgentFeaturedMlsIds();
  if (ids.length === 0 && maxList > 0) {
    const fallback = await pickFallbackFeaturedMlsId(client);
    if (fallback) ids = [fallback];
  }

  for (const mlsId of ids.slice(0, maxList)) {
    const { data: row, error } = await client.from("mls_listings").select("*").eq("mls_id", mlsId).maybeSingle();
    if (error || !row) {
      await logSeoAgentActivity({
        run_id,
        level: "warn",
        kind: "listing_post_skipped",
        summary: `MLS ${mlsId}: not found`,
        detail: { mls_id: mlsId },
      });
      continue;
    }
    const { data: clash } = await client
      .from("blog_posts")
      .select("id")
      .eq("source_mls_id", mlsId)
      .eq("post_kind", "curated")
      .maybeSingle();
    if (clash) {
      await logSeoAgentActivity({
        run_id,
        level: "info",
        kind: "listing_post_skipped",
        summary: `MLS ${mlsId}: curated post already exists`,
        detail: { mls_id: mlsId },
      });
      continue;
    }
    const listing = row as MlsListingRow;
    const r = await insertDraftFromListing({ client, row: listing, postKind: "curated" });
    if (r.ok) {
      created_listing.push({ mls_id: mlsId, slug: r.slug });
      await logSeoAgentActivity({
        run_id,
        level: "info",
        kind: "listing_post_created",
        summary: `Featured listing draft: ${mlsId}`,
        detail: { mls_id: mlsId, slug: r.slug },
      });
    } else {
      await logSeoAgentActivity({
        run_id,
        level: "warn",
        kind: "listing_post_skipped",
        summary: `MLS ${mlsId}: ${r.error}`,
        detail: { mls_id: mlsId },
      });
    }
  }
}

export async function runSeoAgentHeartbeat(): Promise<SeoAgentHeartbeatResult> {
  const run_id = randomUUID();
  const errors: string[] = [];
  const created_seo_slugs: string[] = [];
  const created_listing: { mls_id: string; slug?: string }[] = [];

  await logSeoAgentActivity({
    run_id,
    level: "info",
    kind: "run_start",
    summary: "SEO agent heartbeat started",
    detail: { model: seoAgentModel() },
  });

  if (!isSeoAgentEnabled()) {
    await logSeoAgentActivity({
      run_id,
      level: "info",
      kind: "skipped",
      summary: "SEO_AGENT_ENABLED is not true — skipping work",
      detail: {},
    });
    await logSeoAgentActivity({
      run_id,
      level: "info",
      kind: "run_end",
      summary: "Heartbeat finished (disabled)",
      detail: { created_seo_slugs, created_listing },
    });
    return { ok: true, run_id, skipped: true, errors, created_seo_slugs, created_listing };
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    errors.push("Supabase admin client not configured");
    await logSeoAgentActivity({
      run_id,
      level: "error",
      kind: "error_step",
      summary: errors[0]!,
      detail: {},
    });
    await logSeoAgentActivity({
      run_id,
      level: "info",
      kind: "run_end",
      summary: "Finished with errors",
      detail: { errors, created_seo_slugs, created_listing },
    });
    return { ok: false, run_id, errors, created_seo_slugs, created_listing };
  }

  if (!process.env.OPENAI_API_KEY) {
    errors.push("OPENAI_API_KEY is not set");
    await logSeoAgentActivity({
      run_id,
      level: "error",
      kind: "error_step",
      summary: errors[0]!,
      detail: {},
    });
    await logSeoAgentActivity({
      run_id,
      level: "info",
      kind: "run_end",
      summary: "Finished with errors",
      detail: { errors, created_seo_slugs, created_listing },
    });
    return { ok: false, run_id, errors, created_seo_slugs, created_listing };
  }

  let memo: SeoResearchMemo | null = null;
  try {
    const { memo: m, response_id, usage } = await runSeoWebResearch();
    memo = m;
    await logSeoAgentActivity({
      run_id,
      level: "info",
      kind: "web_research",
      summary: m.summary.slice(0, 400) + (m.summary.length > 400 ? "…" : ""),
      detail: {
        response_id,
        usage,
        summary: m.summary.slice(0, 2000),
        suggested_topic: m.suggested_topic,
        citations: m.citations.slice(0, 20),
      },
    });
    await logSeoAgentActivity({
      run_id,
      level: "info",
      kind: "topic_selected",
      summary: m.suggested_topic,
      detail: { suggested_slug_hint: m.suggested_slug_hint },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Research phase failed";
    errors.push(msg);
    await logSeoAgentActivity({
      run_id,
      level: "error",
      kind: "error_step",
      summary: msg,
      detail: {},
    });
  }

  if (memo) {
    await runSeoArticleSteps({ run_id, client, memo, errors, created_seo_slugs });
  }

  await runFeaturedListingSteps({ run_id, client, created_listing });

  await logSeoAgentActivity({
    run_id,
    level: "info",
    kind: "run_end",
    summary: `Heartbeat complete — ${created_seo_slugs.length} SEO post(s), ${created_listing.length} listing draft(s)`,
    detail: { errors, created_seo_slugs, created_listing },
  });

  return { ok: errors.length === 0, run_id, errors, created_seo_slugs, created_listing };
}
